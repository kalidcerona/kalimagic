// HITSUZEN's existing migration startup, published as a same-origin module.
import { migrateTrustedLegacyStorage } from '../legacy-storage-migration.mjs';
try {
  migrateTrustedLegacyStorage({
    target: 'hitsuzen',
    storage: localStorage,
    session: sessionStorage,
    pathname: location.pathname,
    search: location.search,
  });
} catch { /* Preserve the existing optional legacy-migration startup behavior. */ }
