/**
 * A browser-independent practice clock and note-matching state machine.
 * Callers pass monotonic milliseconds. Public elapsed/remaining/at values use seconds.
 * snapshot() also ends a running session when its allotted time has elapsed.
 */
export class PracticeSession {
  #sequence;
  #durationMs;
  #tolerance;
  #holdMs;
  #repeat;
  #state = 'idle';
  #index = 0;
  #hits = 0;
  #streak = 0;
  #bestStreak = 0;
  #results = [];
  #elapsedMs = 0;
  #segmentStart = null;
  #clock = -Infinity;
  #lastFrame = null;
  #holdStart = null;
  #holdSamples = [];
  #wrongStart = null;
  #releaseRequired = false;
  #releaseStart = null;
  #voicedMs = 0;
  #accurateMs = 0;

  constructor({ sequence = [69], duration = 60, tolerance = 25, holdMs = 350, repeat = true } = {}) {
    if (!Array.isArray(sequence) || !sequence.length || sequence.some(note => !Number.isInteger(note) || note < 0 || note > 127)) {
      throw new TypeError('sequence must contain one or more MIDI note numbers.');
    }
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('duration must be positive seconds.');
    if (!Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 100) throw new RangeError('tolerance must be between 0 and 100 cents.');
    if (!Number.isFinite(holdMs) || holdMs <= 0) throw new RangeError('holdMs must be positive milliseconds.');
    this.#sequence = [...sequence];
    this.#durationMs = duration * 1000;
    this.#tolerance = tolerance;
    this.#holdMs = holdMs;
    this.#repeat = Boolean(repeat);
  }

  get state() { return this.#state; }
  get index() { return this.#index; }
  get totalHits() { return this.#hits; }
  get streak() { return this.#streak; }
  get bestStreak() { return this.#bestStreak; }
  get sequence() { return [...this.#sequence]; }

  #now(value) {
    const time = Number.isFinite(value) ? value : performance.now();
    this.#clock = Math.max(this.#clock, time);
    return this.#clock;
  }

  #elapsed(now) {
    return Math.min(this.#durationMs, this.#elapsedMs + (this.#state === 'running' ? now - this.#segmentStart : 0));
  }

  #clearContinuity() {
    this.#lastFrame = null;
    this.#holdStart = null;
    this.#holdSamples = [];
    this.#wrongStart = null;
    this.#releaseStart = null;
  }

  #finish(now) {
    this.#elapsedMs = this.#elapsed(now);
    this.#segmentStart = null;
    this.#state = 'finished';
    this.#clearContinuity();
  }

  start(nowMs) {
    this.#clock = -Infinity;
    const now = this.#now(nowMs);
    this.#state = 'running';
    this.#index = 0;
    this.#hits = 0;
    this.#streak = 0;
    this.#bestStreak = 0;
    this.#results = [];
    this.#elapsedMs = 0;
    this.#segmentStart = now;
    this.#voicedMs = 0;
    this.#accurateMs = 0;
    this.#releaseRequired = false;
    this.#clearContinuity();
    return this.snapshot(now);
  }

  pause(nowMs) {
    const now = this.#now(nowMs);
    this.snapshot(now);
    if (this.#state === 'running') {
      this.#elapsedMs = this.#elapsed(now);
      this.#segmentStart = null;
      this.#state = 'paused';
      this.#clearContinuity();
    }
    return this.snapshot(now);
  }

  resume(nowMs) {
    const now = this.#now(nowMs);
    if (this.#state === 'paused') {
      this.#state = 'running';
      this.#segmentStart = now;
      this.#clearContinuity();
    }
    return this.snapshot(now);
  }

  stop(nowMs) {
    const now = this.#now(nowMs);
    if (this.#state === 'running' || this.#state === 'paused') this.#finish(now);
    return this.snapshot(now);
  }

  update({ midi = null, cents = null, confidence = 1 } = {}, nowMs) {
    const now = this.#now(nowMs);
    const current = this.snapshot(now);
    if (this.#state !== 'running') return { ...current, hit: false };

    const delta = this.#lastFrame === null ? 0 : now - this.#lastFrame;
    // Missing audio frames must never stand in for a continuously held note.
    if (delta > 150) {
      this.#holdStart = null;
      this.#holdSamples = [];
      this.#wrongStart = null;
      this.#releaseStart = null;
    }
    const voiced = Number.isInteger(midi) && Number.isFinite(cents) && Number.isFinite(confidence) && confidence >= 0.75;
    const correct = voiced && midi === this.#sequence[this.#index] && Math.abs(cents) <= this.#tolerance;
    if (voiced && delta > 0 && delta <= 150) {
      this.#voicedMs += delta;
      if (correct) this.#accurateMs += delta;
    }
    this.#lastFrame = now;

    if (voiced && !correct) {
      if (this.#wrongStart === null) this.#wrongStart = now;
      if (now - this.#wrongStart > 700) this.#streak = 0;
    } else {
      this.#wrongStart = null;
    }

    // A repeated target requires a new articulation. Merely keeping a bow moving
    // cannot fill an entire repeated-note exercise with automatic successes.
    if (this.#releaseRequired) {
      this.#holdStart = null;
      this.#holdSamples = [];
      const released = !voiced || midi !== this.#sequence[this.#index];
      if (released) {
        if (this.#releaseStart === null) this.#releaseStart = now;
        if (now - this.#releaseStart >= 180) {
          this.#releaseRequired = false;
          this.#releaseStart = null;
        }
      } else {
        this.#releaseStart = null;
      }
      return { ...this.snapshot(now), hit: false };
    }

    if (!correct) {
      this.#holdStart = null;
      this.#holdSamples = [];
      return { ...this.snapshot(now), hit: false };
    }
    if (this.#holdStart === null) this.#holdStart = now;
    if (delta > 0 || !this.#holdSamples.length) this.#holdSamples.push(cents);
    if (now - this.#holdStart < this.#holdMs) return { ...this.snapshot(now), hit: false };

    const completedMidi = this.#sequence[this.#index];
    this.#hits += 1;
    this.#streak += 1;
    this.#bestStreak = Math.max(this.#streak, this.#bestStreak);
    this.#results.push({
      midi: completedMidi,
      cents: this.#holdSamples.reduce((sum, value) => sum + value, 0) / this.#holdSamples.length,
      at: this.#elapsed(now) / 1000,
    });
    this.#holdStart = null;
    this.#holdSamples = [];
    this.#wrongStart = null;
    if (this.#index + 1 === this.#sequence.length && !this.#repeat) {
      this.#finish(now);
    } else {
      this.#index = (this.#index + 1) % this.#sequence.length;
      this.#releaseRequired = this.#sequence[this.#index] === completedMidi;
      this.#releaseStart = null;
    }
    return { ...this.snapshot(now), hit: true };
  }

  snapshot(nowMs) {
    const now = this.#now(nowMs);
    if (this.#state === 'running' && this.#elapsed(now) >= this.#durationMs) this.#finish(now);
    const elapsedMs = this.#elapsed(now);
    return {
      state: this.#state,
      index: this.#index,
      targetMidi: this.#sequence[this.#index],
      hits: this.#hits,
      streak: this.#streak,
      bestStreak: this.#bestStreak,
      elapsed: elapsedMs / 1000,
      remaining: Math.max(0, this.#durationMs - elapsedMs) / 1000,
      npm: elapsedMs > 0 ? this.#hits * 60000 / elapsedMs : 0,
      accuracy: this.#voicedMs > 0 ? this.#accurateMs / this.#voicedMs * 100 : null,
      holdProgress: this.#holdStart !== null && this.#state === 'running' ? Math.min(1, Math.max(0, now - this.#holdStart) / this.#holdMs) : 0,
      progress: elapsedMs / this.#durationMs,
      finished: this.#state === 'finished',
      results: this.#results.map(result => ({ ...result })),
      releaseRequired: this.#releaseRequired,
    };
  }
}
