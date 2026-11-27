-- Prepare only. Do not apply without the separately authorized deployment step.
-- Agreement evidence is private: preserve the native service-key-only profiles
-- model (RLS enabled, no client policies). Existing rows remain NULL.
begin;
set local lock_timeout = '5s';

-- Preview the affected table size before taking the short schema lock.
select count(*) as profiles_before_migration from public.profiles;

-- Serialize the definition check with concurrent DDL before inspecting columns.
lock table public.profiles in access exclusive mode;

do $migration$
declare
  agreement_column_count integer;
  matching_column_count integer;
begin
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.profiles'::regclass
      and relkind = 'r' and relrowsecurity
  ) then
    raise exception 'profiles must be an ordinary RLS-enabled table';
  end if;

  -- The maintained schema has no profiles policies. Do not broaden or silently
  -- replace policies from an unexpected deployment: require explicit review.
  if exists (
    select 1 from pg_catalog.pg_policy
    where polrelid = 'public.profiles'::regclass
  ) then
    raise exception 'unexpected profiles policies require privacy review';
  end if;
  if exists (
    select 1 from pg_catalog.pg_roles
    where rolname in ('anon', 'authenticated') and (rolsuper or rolbypassrls)
  ) then
    raise exception 'client roles must not bypass profiles RLS';
  end if;

  select count(*) into agreement_column_count
  from pg_catalog.pg_attribute
  where attrelid = 'public.profiles'::regclass and attnum > 0
    and not attisdropped
    and attname in ('terms_version', 'privacy_version', 'agreed_at');

  if agreement_column_count = 0 then
    alter table public.profiles
      add column terms_version text,
      add column privacy_version text,
      add column agreed_at timestamptz;
  elsif agreement_column_count <> 3 then
    raise exception 'partial agreement columns require explicit repair';
  end if;

  -- Re-runs accept only the exact expected definition. IF NOT EXISTS alone
  -- would incorrectly accept incompatible types/defaults or generated values.
  select count(*) into matching_column_count
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.profiles'::regclass and a.attnum > 0
    and not a.attisdropped and not a.attnotnull and not a.atthasdef
    and a.attidentity = '' and a.attgenerated = '' and a.atttypmod = -1
    and (
      (a.attname in ('terms_version', 'privacy_version')
        and a.atttypid = 'pg_catalog.text'::regtype)
      or (a.attname = 'agreed_at'
        and a.atttypid = 'pg_catalog.timestamptz'::regtype)
    );
  if matching_column_count <> 3 then
    raise exception 'agreement columns do not match the nullable no-default definition';
  end if;
end;
$migration$;

-- Do not backfill agreement evidence or modify client grants/policies.
-- Only the authenticated server handler records actual consent/version/time.
commit;
