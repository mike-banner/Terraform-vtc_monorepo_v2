// Logique pure des événements de courses (ADR-014) : sans DOM, réutilisable dans un service worker (D-05).
const ISO = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

// Horodatage Postgres (timestamptz JSON / PostgREST) en microsecondes ; null si illisible.
// Date.parse s'arrête à la milliseconde : deux écritures dans la même milliseconde seraient égales.
export function toMicros(value) {
  if (typeof value !== 'string') return null;
  const m = ISO.exec(value);
  if (!m) return null;
  let tz = m[4];
  if (/^[+-]\d{2}$/.test(tz)) tz += ':00';
  else if (/^[+-]\d{4}$/.test(tz)) tz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  const ms = Date.parse(`${m[1]}T${m[2]}${tz}`);
  if (Number.isNaN(ms)) return null;
  // ms est à la seconde (fraction non passée à Date.parse) : la fraction s'ajoute entière, en microsecondes.
  return ms * 1000 + Number((m[3] ?? '').padEnd(6, '0').slice(0, 6));
}

// Un événement plus ancien ou égal au cache est ignoré (D-06) ; dans le doute (cache absent ou illisible), relire.
export function shouldApply(cachedUpdatedAt, eventUpdatedAt) {
  const cached = toMicros(cachedUpdatedAt);
  const incoming = toMicros(eventUpdatedAt);
  if (cached === null || incoming === null) return true;
  return incoming > cached;
}

// Le client n'utilise que id et updated_at ; tout autre message est ignoré.
export function isBookingEvent(payload) {
  return payload !== null && typeof payload === 'object'
    && typeof payload.id === 'string' && typeof payload.updated_at === 'string';
}
