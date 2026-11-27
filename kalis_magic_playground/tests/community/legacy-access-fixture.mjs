export function accessDatabase(initial = {}, failedTool = '') {
  const rows = Object.fromEntries(['tool_access', 'friend_app_access'].map((table) => [table,
    structuredClone(initial[table] || []).map((row) => ({ lifetime: false, per_app_access: null, ...row }))]));
  let reads = 0;
  let writes = 0;
  const db = { rows, beforeMutation: null, get reads() { return reads; }, get writes() { return writes; }, from(table) {
    const filters = [];
    return {
      select() { return this; }, limit() { return this; },
      eq(key, value) { filters.push((row) => key === 'per_app_access' ? JSON.stringify(row[key]) === value : row[key] === value); return this; },
      is(key, value) { filters.push((row) => (row[key] ?? null) === value); return this; },
      ilike(key, value) { filters.push((row) => String(row[key] || '').toLowerCase() === value.toLowerCase()); return this; },
      update(patch) { this.patch = patch; this.mode = 'update'; return this; },
      insert(patch) { this.patch = patch; this.mode = 'insert'; return this; },
      delete() { this.mode = 'delete'; return this; },
      async maybeSingle() { const result = await this; return { ...result, data: result.data?.[0] || null }; },
      async then(resolve, reject) {
        try {
          if (this.mode) { writes += 1; if (db.beforeMutation) await db.beforeMutation(this, table); }
          else reads += 1;
          const matches = rows[table].filter((row) => filters.every((filter) => filter(row)));
          if (this.mode && this.patch?.tool === failedTool) return resolve({ data: null, error: { code: 'db_error' } });
          if (this.mode === 'insert') {
            if (rows[table].some((row) => row.email === this.patch.email && (table === 'tool_access' || row.tool === this.patch.tool))) return resolve({ data: null, error: { code: '23505' } });
            const row = { id: `new-${rows[table].length}`, lifetime: false, per_app_access: null, ...this.patch };
            rows[table].push(row);
            return resolve({ data: structuredClone([row]), error: null });
          }
          if (this.mode === 'update') matches.forEach((row) => Object.assign(row, this.patch));
          if (this.mode === 'delete') rows[table] = rows[table].filter((row) => !matches.includes(row));
          return resolve({ data: structuredClone(matches), error: null });
        } catch (error) { return reject(error); }
      }
    };
  } };
  return db;
}
