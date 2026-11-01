import {nodes} from './graph.js';

// Journey data is separate from account data. This module never reads browser
// storage, cookies or the current URL; callers can handle unavailable storage.
export const JOURNEY_VERSION = 1;
export const MAX_QUERY_LENGTH = 160;
const screens = new Set(['login', 'map', 'route', 'navigation', 'arrival']);
const categories = new Set(['All', 'Shopping', 'Food', 'Leisure', 'Facilities']);
const nodeIds = new Set(Object.keys(nodes));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const defaults = Object.freeze({
  screen: 'map', start: 'entrance', destination: 'cinema', floor: 1, step: 0,
  accessible: false, congestion: false, query: '', category: 'All', guest: false
});

/** Return a fresh, validated whitelist of journey fields, or null.
 * Account objects, names, passwords, tokens and other unknown fields are ignored.
 * Step is structurally validated here; clamp it to the computed route in the UI.
 */
export function sanitizeJourney(input) {
  if (!object(input)) return null;
  const result = {};
  for (const key of Object.keys(defaults)) result[key] = own(input, key) ? input[key] : defaults[key];
  if (!screens.has(result.screen) || !nodeIds.has(result.start) || !nodeIds.has(result.destination)) return null;
  if (result.floor !== 1 && result.floor !== 2) return null;
  if (!Number.isSafeInteger(result.step) || result.step < 0 || result.step > 10000) return null;
  if (typeof result.accessible !== 'boolean' || typeof result.congestion !== 'boolean' || typeof result.guest !== 'boolean') return null;
  if (typeof result.query !== 'string' || !categories.has(result.category)) return null;
  result.query = result.query.slice(0, MAX_QUERY_LENGTH);
  return result;
}

/** Serialize only the journey whitelist. Returns null for invalid input. */
export function serializeJourney(input) {
  const journey = sanitizeJourney(input);
  return journey ? JSON.stringify({version: JOURNEY_VERSION, journey}) : null;
}

/** Malformed, oversized or obsolete snapshots are discarded without throwing. */
export function deserializeJourney(text) {
  if (typeof text !== 'string' || text.length > 4096) return null;
  try {
    const snapshot = JSON.parse(text);
    if (!object(snapshot) || snapshot.version !== JOURNEY_VERSION || !object(snapshot.journey)) return null;
    return sanitizeJourney(snapshot.journey);
  } catch {
    return null;
  }
}

/** Build a local hash route. Guest identity and all account data are omitted. */
export function buildJourneyHash(input) {
  const journey = sanitizeJourney(input);
  if (!journey) return null;
  if (journey.screen === 'login') return '#/login';
  const params = new URLSearchParams({
    from: journey.start, to: journey.destination,
    stepFree: journey.accessible ? '1' : '0', busy: journey.congestion ? '1' : '0',
    floor: String(journey.floor), step: String(journey.step)
  });
  if (journey.query) params.set('q', journey.query);
  if (journey.category !== 'All') params.set('category', journey.category);
  return `#/${journey.screen}?${params}`;
}

/** Parse a local hash into validated journey data, or null.
 * Parsing never grants guest/account access: guest is always false. The app must
 * check its own session/guest gate before showing a protected screen.
 */
export function parseJourneyHash(hash) {
  if (typeof hash !== 'string' || hash.length > 4096 || !hash.startsWith('#/') || hash.slice(1).includes('#')) return null;
  const queryAt = hash.indexOf('?');
  const screen = hash.slice(2, queryAt === -1 ? undefined : queryAt);
  if (!screens.has(screen)) return null;
  const query = queryAt === -1 ? '' : hash.slice(queryAt + 1);
  try { decodeURIComponent(query); } catch { return null; }
  const params = new URLSearchParams(query);
  const known = ['from', 'to', 'stepFree', 'busy', 'floor', 'step', 'q', 'category'];
  if (known.some(key => params.getAll(key).length > 1)) return null;
  const result = {screen, guest: false};
  for (const [urlKey, stateKey] of [['from', 'start'], ['to', 'destination'], ['q', 'query'], ['category', 'category']]) {
    if (params.has(urlKey)) result[stateKey] = params.get(urlKey);
  }
  for (const [urlKey, stateKey] of [['stepFree', 'accessible'], ['busy', 'congestion']]) {
    if (!params.has(urlKey)) continue;
    if (!['0', '1'].includes(params.get(urlKey))) return null;
    result[stateKey] = params.get(urlKey) === '1';
  }
  for (const key of ['floor', 'step']) {
    if (!params.has(key)) continue;
    const value = params.get(key);
    if (!/^(0|[1-9]\d*)$/.test(value)) return null;
    result[key] = Number(value);
  }
  return sanitizeJourney(result);
}
