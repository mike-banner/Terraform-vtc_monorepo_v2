import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toConnectionState, needsResync, createSyncStore } from './sync-state.mjs';

function fakeSource(initial = true) {
  const s = { online: initial, emit: null, subs: 0 };
  s.source = {
    isOnline: () => s.online,
    subscribe(cb) { s.emit = cb; s.subs++; return () => { s.subs--; }; },
  };
  return s;
}

test('toConnectionState : hors ligne prioritaire', () => {
  for (const st of ['idle', 'SUBSCRIBED', 'CLOSED']) assert.equal(toConnectionState(st, false), 'offline');
});
test('toConnectionState : online', () => {
  assert.equal(toConnectionState('SUBSCRIBED', true), 'online');
  assert.equal(toConnectionState('idle', true), 'online');
});
test('toConnectionState : reconnecting', () => {
  for (const st of ['joining', 'TIMED_OUT', 'CLOSED', 'CHANNEL_ERROR']) assert.equal(toConnectionState(st, true), 'reconnecting');
});
test('needsResync : SUBSCRIBED seulement', () => {
  assert.equal(needsResync('SUBSCRIBED'), true);
  for (const st of ['idle', 'joining', 'TIMED_OUT', 'CLOSED', 'CHANNEL_ERROR']) assert.equal(needsResync(st), false);
});
test('store : état initial online', () => {
  assert.equal(createSyncStore(fakeSource().source).getSnapshot().state, 'online');
});
test('store : statut de canal notifie et passe reconnecting', () => {
  const store = createSyncStore(fakeSource().source);
  let n = 0;
  store.subscribe(() => n++);
  const before = n;
  store.setChannelStatus('CHANNEL_ERROR');
  assert.ok(n > before);
  assert.equal(store.getSnapshot().state, 'reconnecting');
});
test('store : source hors ligne -> offline', () => {
  const f = fakeSource();
  const store = createSyncStore(f.source);
  store.subscribe(() => {});
  f.emit(false);
  assert.equal(store.getSnapshot().state, 'offline');
});
test('store : markEvent', () => {
  const store = createSyncStore(fakeSource().source);
  store.markEvent(1000);
  assert.equal(store.getSnapshot().lastEventAt, 1000);
});
test('store : snapshot stable tant que rien ne change', () => {
  const store = createSyncStore(fakeSource().source);
  const a = store.getSnapshot();
  store.setChannelStatus('idle');
  assert.equal(store.getSnapshot(), a);
});
test('store : source abonnée au premier abonné, désabonnée au dernier départ', () => {
  const f = fakeSource();
  const store = createSyncStore(f.source);
  assert.equal(f.subs, 0);
  const u1 = store.subscribe(() => {});
  const u2 = store.subscribe(() => {});
  assert.equal(f.subs, 1);
  u1();
  assert.equal(f.subs, 1);
  u2();
  assert.equal(f.subs, 0);
});
