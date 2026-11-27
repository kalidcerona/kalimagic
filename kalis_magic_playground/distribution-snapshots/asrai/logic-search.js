// Name search and the audience contact list projection.

export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function nameMatchesQuery(name, query) {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return normalizeSearch(name).includes(needle);
}

export function projectAudienceList(contacts, query) {
  if (!Array.isArray(contacts)) return [];
  const rows = [];
  for (const contact of contacts) {
    if (!contact || typeof contact.id !== "string" || typeof contact.name !== "string") {
      continue;
    }
    if (!nameMatchesQuery(contact.name, query)) continue;
    rows.push({ id: contact.id, name: contact.name });
  }
  return rows;
}
