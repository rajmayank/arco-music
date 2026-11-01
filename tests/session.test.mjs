import test from 'node:test';
import assert from 'node:assert/strict';
import { PracticeSession } from '../web/js/session.js';

const pitch = (midi, cents = 0, confidence = 1) => ({ midi, cents, confidence });
const hold = (session, midi, start, end, cents = 0) => {
  let result;
  for (let now = start; now <= end; now += 50) result = session.update(pitch(midi, cents), now);
  return result;
};

test('stable target advances and scores, with exact octave matching', () => {
  const session = new PracticeSession({ sequence: [69, 71] });
  session.start(0);
  hold(session, 81, 0, 500);
  assert.equal(session.totalHits, 0);
  const hit = hold(session, 69, 550, 900, 7);
  assert.equal(hit.hit, true);
  assert.equal(hit.hits, 1);
  assert.equal(hit.targetMidi, 71);
  assert.equal(hit.results[0].cents, 7);
  assert.equal(hit.results[0].at, 0.9);
  assert.equal(hit.holdProgress, 0);
});

test('wrong note, low confidence, silence, and large frame gaps reset a hold', () => {
  for (const interruption of [pitch(68), pitch(69, 30), pitch(69, 0, 0.2), pitch(null)]) {
    const session = new PracticeSession();
    session.start(0);
    hold(session, 69, 0, 200);
    session.update(interruption, 250);
    hold(session, 69, 300, 600);
    assert.equal(session.totalHits, 0);
    assert.equal(session.update(pitch(69), 650).hit, true);
  }
  const session = new PracticeSession();
  session.start(0);
  session.update(pitch(69), 0);
  assert.equal(session.update(pitch(69), 500).hit, false);
  assert.equal(hold(session, 69, 550, 850).hit, true);
});

test('repeated notes require a sustained release and a fresh hold', () => {
  const session = new PracticeSession({ sequence: [69, 69, 71] });
  session.start(0);
  hold(session, 69, 0, 1000);
  assert.equal(session.totalHits, 1);
  assert.equal(session.snapshot(1000).releaseRequired, true);
  for (let now = 1050; now <= 1200; now += 50) session.update(pitch(null), now);
  session.update(pitch(69), 1250);
  assert.equal(session.snapshot(1250).releaseRequired, true, 'short release does not count');
  for (let now = 1300; now <= 1500; now += 50) session.update(pitch(null), now);
  assert.equal(session.snapshot(1500).releaseRequired, false);
  assert.equal(hold(session, 69, 1550, 1900).hit, true);
  assert.equal(session.index, 2);
});

test('paused time is excluded, and stopping from pause preserves elapsed time', () => {
  const session = new PracticeSession({ duration: 10 });
  session.start(1000);
  session.pause(3000);
  assert.equal(session.snapshot(9000).elapsed, 2);
  session.resume(11000);
  assert.equal(session.snapshot(14000).elapsed, 5);
  session.pause(15000);
  const stopped = session.stop(25000);
  assert.equal(stopped.elapsed, 6);
  assert.equal(stopped.remaining, 4);
  assert.equal(stopped.state, 'finished');
});

test('timer ends at the exact configured duration and ignores later notes', () => {
  const session = new PracticeSession({ duration: 1 });
  session.start(0);
  hold(session, 69, 0, 350);
  assert.equal(session.snapshot(5000).elapsed, 1);
  assert.equal(session.state, 'finished');
  const final = session.update(pitch(69), 5500);
  assert.equal(final.remaining, 0);
  assert.equal(final.npm, 60);
  assert.equal(final.progress, 1);
  assert.equal(final.hits, 1);
  assert.equal(final.hit, false);
});

test('non-repeating sequences finish after their final note', () => {
  const session = new PracticeSession({ sequence: [69, 71], repeat: false });
  session.start(0);
  hold(session, 69, 0, 350);
  const final = hold(session, 71, 400, 750);
  assert.equal(final.hit, true);
  assert.equal(final.finished, true);
  assert.equal(final.index, 1);
  assert.equal(final.hits, 2);
  assert.equal(final.bestStreak, 2);
});

test('accuracy excludes silence and missing frames', () => {
  const session = new PracticeSession({ holdMs: 1000 });
  session.start(0);
  assert.equal(session.snapshot(0).accuracy, null);
  hold(session, 69, 0, 200);
  hold(session, 70, 250, 400);
  assert.equal(session.snapshot(400).accuracy, 50);
  session.update(pitch(null), 450);
  session.update(pitch(69), 1500);
  assert.equal(session.snapshot(1500).accuracy, 50);
});

test('streak survives silence and brief transitions, but resets after sustained wrong pitch', () => {
  const session = new PracticeSession({ sequence: [69, 71] });
  session.start(0);
  hold(session, 69, 0, 350);
  hold(session, 70, 400, 650);
  assert.equal(session.streak, 1);
  session.update(pitch(null), 700);
  hold(session, 70, 750, 1500);
  assert.equal(session.streak, 0);
  assert.equal(session.bestStreak, 1);
});

test('duplicate timestamps cannot earn a note and snapshots are immutable copies', () => {
  const session = new PracticeSession({ sequence: [69, 71] });
  session.start(0);
  for (let i = 0; i < 100; i++) session.update(pitch(69), 0);
  assert.equal(session.totalHits, 0);
  hold(session, 69, 50, 350);
  const snapshot = session.snapshot(350);
  snapshot.results[0].midi = 1;
  session.sequence[0] = 1;
  assert.equal(session.snapshot(350).results[0].midi, 69);
  assert.equal(session.sequence[0], 69);
});

test('pause and resume cannot complete a held note across the break', () => {
  const session = new PracticeSession();
  session.start(0);
  hold(session, 69, 0, 200);
  session.pause(225);
  session.resume(2000);
  assert.equal(hold(session, 69, 2000, 2300).hit, false);
  assert.equal(session.update(pitch(69), 2350).hit, true);
});

test('constructor rejects unusable configuration', () => {
  assert.throws(() => new PracticeSession({ sequence: [] }), TypeError);
  assert.throws(() => new PracticeSession({ sequence: [128] }), TypeError);
  assert.throws(() => new PracticeSession({ duration: 0 }), RangeError);
  assert.throws(() => new PracticeSession({ holdMs: 0 }), RangeError);
});
