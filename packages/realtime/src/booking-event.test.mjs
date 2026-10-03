import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMicros, shouldApply, isBookingEvent } from './booking-event.mjs';

const base = Date.parse('2026-10-03T02:50:17Z') * 1000;

test('toMicros : microsecondes exactes', () => {
  assert.equal(toMicros('2026-10-03T02:50:17.074776+00:00'), base + 74776);
});
test('toMicros : fraction courte complétée', () => {
  assert.equal(toMicros('2026-10-03T02:50:17.5+00:00'), base + 500000);
});
test('toMicros : Z et +00:00 équivalents', () => {
  assert.equal(toMicros('2026-10-03T02:50:17Z'), toMicros('2026-10-03T02:50:17+00:00'));
});
test('toMicros : +02 traité comme +02:00', () => {
  assert.equal(toMicros('2026-10-03T04:50:17+02'), base);
  assert.equal(toMicros('2026-10-03T04:50:17+02'), toMicros('2026-10-03T04:50:17+02:00'));
});
test('toMicros : espace au lieu de T', () => {
  assert.equal(toMicros('2026-10-03 02:50:17.000001+00:00'), base + 1);
});
test('toMicros : valeurs illisibles -> null', () => {
  assert.equal(toMicros('abc'), null);
  assert.equal(toMicros(null), null);
  assert.equal(toMicros(42), null);
});
test('shouldApply : microseconde suivante dans la même milliseconde', () => {
  assert.equal(shouldApply('2026-10-03T02:50:17.074776+00:00', '2026-10-03T02:50:17.074777+00:00'), true);
});
test('shouldApply : égal ou plus ancien ignoré', () => {
  assert.equal(shouldApply('2026-10-03T02:50:17.074776+00:00', '2026-10-03T02:50:17.074776+00:00'), false);
  assert.equal(shouldApply('2026-10-03T02:50:17.074776+00:00', '2026-10-03T02:50:17.074775+00:00'), false);
});
test('shouldApply : cache absent ou illisible -> true', () => {
  assert.equal(shouldApply(null, '2026-10-03T02:50:17+00:00'), true);
  assert.equal(shouldApply(undefined, '2026-10-03T02:50:17+00:00'), true);
  assert.equal(shouldApply('nope', '2026-10-03T02:50:17+00:00'), true);
});
test('isBookingEvent : valide', () => {
  assert.equal(isBookingEvent({ id: 'x', updated_at: '2026-10-03T02:50:17+00:00', status: 'paid', mission_status: 'to_validate', driver_id: null }), true);
});
test('isBookingEvent : invalide', () => {
  assert.equal(isBookingEvent({ updated_at: 'a' }), false);
  assert.equal(isBookingEvent({ id: 'x', updated_at: 5 }), false);
  assert.equal(isBookingEvent(null), false);
});
