import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../web/js/audio.js';

function tone(frequency, { rate = 48000, amplitude = 0.3, harmonics = [1], length = 4096, noise = 0 } = {}) {
  let seed = 81723;
  return Float32Array.from({ length }, (_, i) => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    let value = noise * ((seed / 4294967296) * 2 - 1);
    for (let h = 0; h < harmonics.length; h++) value += amplitude * harmonics[h] * Math.sin(2 * Math.PI * frequency * (h + 1) * i / rate + 0.37 * h);
    return value;
  });
}

for (const rate of [44100, 48000, 96000]) {
  test(`open strings and first-position pitches at ${rate} Hz`, () => {
    for (const frequency of [196, 293.6648, 440, 659.2551, 987.7666, 1318.5102]) {
      const result = detectPitch(tone(frequency, { rate }), rate);
      assert.ok(result.frequency, `No pitch at ${frequency}`);
      const cents = 1200 * Math.log2(result.frequency / frequency);
      assert.ok(Math.abs(cents) < 4, `${frequency} detected ${result.frequency}, ${cents} cents`);
      assert.ok(result.confidence > 0.95);
    }
  });
}

test('harmonic-rich violin signal retains its fundamental', () => {
  for (const frequency of [196, 293.6648, 440, 659.2551]) {
    const result = detectPitch(tone(frequency, { harmonics: [0.45, 1, 0.75, 0.35, 0.2], noise: 0.015 }), 48000);
    assert.ok(result.frequency);
    assert.ok(Math.abs(1200 * Math.log2(result.frequency / frequency)) < 5);
    assert.ok(result.confidence > 0.9);
  }
});

test('rejects silence, quiet input and broadband noise', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48000).frequency, null);
  assert.equal(detectPitch(tone(440, { amplitude: 0.001 }), 48000).frequency, null);
  assert.equal(detectPitch(tone(0, { harmonics: [], noise: 0.2 }), 48000).frequency, null);
});

test('custom gate and DC offset do not corrupt pitch', () => {
  const quiet = tone(440, { amplitude: 0.004 });
  assert.ok(detectPitch(quiet, 48000, { rmsThreshold: 0.001 }).frequency);
  const offset = tone(440).map(value => value + 0.25);
  assert.ok(Math.abs(detectPitch(offset, 48000).frequency - 440) < 0.5);
});

test('invalid and out-of-range input is rejected', () => {
  assert.equal(detectPitch(new Float32Array(20), 48000).frequency, null);
  assert.equal(detectPitch(new Float32Array(4096).fill(NaN), 48000).frequency, null);
  assert.equal(detectPitch(tone(440), 0).frequency, null);
  assert.equal(detectPitch(tone(60), 48000).frequency, null);
});

test('extended engine range resolves low cello fundamentals without octave folding', () => {
  for (const rate of [44100, 48000, 96000]) {
    for (const frequency of [65.4064, 98, 146.8324, 220]) {
      const samples = tone(frequency, { rate, length: 8192, harmonics: [0.45, 1, 0.65, 0.3], noise: 0.008 });
      const result = detectPitch(samples, rate, { minFrequency: 55 });
      assert.ok(result.frequency, `No cello pitch at ${frequency} Hz, ${rate} sample rate`);
      assert.ok(Math.abs(1200 * Math.log2(result.frequency / frequency)) < 5);
    }
  }
});
