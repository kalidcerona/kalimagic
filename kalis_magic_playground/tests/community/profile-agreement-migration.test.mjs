import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const directory=new URL('../../supabase/migrations/',import.meta.url);
const sql=readFileSync(new URL('20261127_profile_agreement.sql',directory),'utf8');
const executable=sql.replace(/--[^\n]*/g,'');

test('agreement migration counts before DDL, accepts only absent or exact complete definition',()=>{
 assert.ok(executable.indexOf('select count(*) into agreement_column_count') < executable.indexOf('add column terms_version'));
 assert.match(executable,/if agreement_column_count = 0 then/);
 assert.match(executable,/elsif agreement_column_count <> 3 then\s+raise exception/);
 const added=[...executable.matchAll(/add column (\w+) (\w+)/g)].map(match=>match.slice(1));
 assert.deepEqual(added,[['terms_version','text'],['privacy_version','text'],['agreed_at','timestamptz']]);
 for(const token of ['not a.attisdropped','not a.attnotnull','not a.atthasdef',"a.attidentity = ''","a.attgenerated = ''",'a.atttypmod = -1',"'pg_catalog.text'::regtype","'pg_catalog.timestamptz'::regtype"])
  assert.ok(executable.includes(token),token);
 assert.match(executable,/if matching_column_count <> 3 then\s+raise exception/);
 assert.doesNotMatch(executable,/if not exists\s+\w*\s*column|add column if not exists/i);
});
test('agreement migration preserves private service-role access and existing rows',()=>{
 assert.match(executable,/relkind = 'r' and relrowsecurity/);
 assert.match(executable,/pg_catalog\.pg_policy[\s\S]*polrelid = 'public.profiles'::regclass[\s\S]*raise exception 'unexpected profiles policies/);
 assert.match(executable,/rolname in \('anon', 'authenticated'\) and \(rolsuper or rolbypassrls\)/);
 assert.doesNotMatch(executable,/\b(grant|revoke|create policy|drop policy|disable row level security|update|insert|delete|truncate|drop column|security definer)\b/i);
 const native=readFileSync(new URL('20260706_magic_playground.sql',directory),'utf8');
 assert.match(native,/alter table public\.profiles enable row level security/);
 for(const file of readdirSync(directory).filter(file=>file.endsWith('.sql')&&file!=='20261127_profile_agreement.sql')) {
  const previous=readFileSync(new URL(file,directory),'utf8').replace(/--[^\n]*/g,'');
  assert.doesNotMatch(previous,/create policy[^;]+on\s+(?:public\.)?profiles\b/i,`${file}: profiles privacy assumptions changed`);
 }
});
test('definition checks and nullable additions are atomic and serialized',()=>{
 assert.match(executable,/^\s*begin;/);assert.match(executable,/commit;\s*$/);
 assert.ok(executable.indexOf('lock table public.profiles in access exclusive mode') < executable.indexOf('do $migration$'));
 assert.match(executable,/set local lock_timeout = '5s'/);
 assert.equal((executable.match(/add column/g)||[]).length,3);
});
