/** Browser-local, monophonic pitch analysis. No audio leaves the device. */
export function detectPitch(samples, sampleRate, options = {}) {
  const minFrequency = options.minFrequency ?? 90;
  const maxFrequency = options.maxFrequency ?? 1500;
  const rmsThreshold = options.rmsThreshold ?? 0.008;
  const empty = (rms = 0) => ({ frequency: null, confidence: 0, rms });
  if (!samples || samples.length < 64 || !Number.isFinite(sampleRate) || sampleRate <= 0 ||
      minFrequency <= 0 || maxFrequency <= minFrequency) return empty();

  let mean = 0;
  for (let i = 0; i < samples.length; i++) mean += samples[i];
  mean /= samples.length;
  if (!Number.isFinite(mean)) return empty();
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += (samples[i] - mean) ** 2;
  const rms = Math.sqrt(energy / samples.length);
  if (rms < rmsThreshold) return empty(rms);

  // Averaging before decimation keeps the work bounded at microphone sample rates.
  // 24 kHz retains enough samples per period for accurate high violin notes.
  const stride = Math.max(1, Math.floor(sampleRate / 24000));
  const rate = sampleRate / stride;
  const count = Math.floor(samples.length / stride);
  const signal = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let j = 0; j < stride; j++) sum += samples[i * stride + j] - mean;
    signal[i] = sum / stride;
  }
  const minLag = Math.max(2, Math.floor(rate / maxFrequency));
  const maxLag = Math.min(Math.ceil(rate / minFrequency) + 1, Math.floor(count / 2));
  if (minLag >= maxLag) return empty(rms);
  const window = count - maxLag;
  const difference = new Float64Array(maxLag + 1);
  const normalized = new Float64Array(maxLag + 1);
  normalized[0] = 1;
  let cumulative = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = signal[i] - signal[i + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
    cumulative += sum;
    normalized[lag] = cumulative > 0 ? sum * lag / cumulative : 1;
  }

  // YIN's first sufficiently deep dip favors the fundamental over its multiples.
  let candidate = -1;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (normalized[lag] < 0.13) {
      while (lag + 1 <= maxLag && normalized[lag + 1] < normalized[lag]) lag++;
      candidate = lag;
      break;
    }
  }
  if (candidate < 0) {
    for (let lag = minLag; lag < maxLag; lag++) {
      if (candidate < 0 || normalized[lag] < normalized[candidate]) candidate = lag;
    }
    if (normalized[candidate] > 0.2) return empty(rms);
  }
  if (candidate <= minLag && normalized[candidate + 1] > normalized[candidate] && rate / candidate > maxFrequency * 1.02) return empty(rms);
  let period = candidate;
  // Interpolate the raw difference curve. It reduces high-note bias versus CMND.
  if (candidate > 1 && candidate < maxLag) {
    const left = difference[candidate - 1];
    const center = difference[candidate];
    const right = difference[candidate + 1];
    const denominator = left - 2 * center + right;
    if (Math.abs(denominator) > 1e-12) period += Math.max(-0.5, Math.min(0.5, (left - right) / (2 * denominator)));
  }
  const frequency = rate / period;
  if (!Number.isFinite(frequency) || frequency < minFrequency * 0.995 || frequency > maxFrequency * 1.005) return empty(rms);
  return { frequency, confidence: Math.max(0, Math.min(1, 1 - normalized[candidate])), rms };
}

export class AudioEngine {
  constructor() {
    this._context = null;
    this._stream = null;
    this._source = null;
    this._analyser = null;
    this._generation = 0;
    this._raf = null;
    this._running = false;
    this._threshold = 0.008;
    this._toneUntil = 0;
    this._outputs = new Set();
    this._metronomeTimer = null;
    this._metronomeGeneration = 0;
    this._onFrame = null;
    this._onError = null;
  }

  get isRunning() { return this._running; }
  get isPlayingTone() { return performance.now() < this._toneUntil; }

  setThreshold(value) {
    if (Number.isFinite(value)) this._threshold = Math.max(0.001, Math.min(0.1, value));
  }

  _ensureContext() {
    if (!this._context || this._context.state === 'closed') {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('This browser does not support Web Audio. Try a current version of Chrome, Safari, or Edge.');
      this._context = new Context({ latencyHint: 'interactive' });
    }
    return this._context;
  }

  async listDevices() {
    if (!globalThis.navigator?.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  }

  async start({ deviceId, onFrame, onError } = {}) {
    this.stop();
    const generation = this._generation;
    this._onFrame = onFrame;
    this._onError = onError;
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access needs HTTPS or localhost and a browser with microphone support.');
    }
    const context = this._ensureContext();
    // Resume during the initiating gesture, before awaiting a permission prompt.
    const resumed = context.resume().then(() => null, error => error);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          channelCount: { ideal: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (generation !== this._generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const resumeError = await resumed;
      if (resumeError) throw resumeError;
      if (generation !== this._generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this._stream = stream;
      this._source = context.createMediaStreamSource(stream);
      this._analyser = context.createAnalyser();
      // A larger window resolves low cello C2 as well as the violin range.
      this._analyser.fftSize = 8192;
      this._analyser.smoothingTimeConstant = 0;
      this._source.connect(this._analyser);
      // The microphone graph intentionally never connects to the speakers.
      this._running = true;
      context.onstatechange = () => {
        if (generation !== this._generation || !this._running || context.state === 'running') return;
        const handler = this._onError;
        this.stop();
        handler?.(new Error('Audio input was interrupted. Enable the microphone again to resume practice.'));
      };
      for (const track of stream.getTracks()) {
        track.onended = () => {
          if (generation !== this._generation || !this._running) return;
          const handler = this._onError;
          this.stop();
          handler?.(new Error('The microphone disconnected. Reconnect it and enable the microphone again.'));
        };
      }
      const samples = new Float32Array(this._analyser.fftSize);
      let lastFrame = -Infinity;
      const frame = now => {
        if (!this._running || generation !== this._generation) return;
        this._raf = requestAnimationFrame(frame);
        if (now - lastFrame < 32) return;
        lastFrame = now;
        this._analyser.getFloatTimeDomainData(samples);
        const result = detectPitch(samples, context.sampleRate, { minFrequency: 55, rmsThreshold: this._threshold });
        // Short copied waveform is safe for callers to retain or draw later.
        const waveform = new Float32Array(128);
        for (let i = 0; i < waveform.length; i++) waveform[i] = samples[i * 4];
        this._onFrame?.({ ...result, waveform, sampleRate: context.sampleRate, timestamp: now });
      };
      this._raf = requestAnimationFrame(frame);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (generation !== this._generation) return;
      this.stop();
      throw error;
    }
  }

  stop() {
    this._generation++;
    this._running = false;
    if (this._raf !== null) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._stream) {
      for (const track of this._stream.getTracks()) { track.onended = null; track.stop(); }
    }
    this._stream = null;
    this._source?.disconnect();
    this._analyser?.disconnect();
    this._source = null;
    this._analyser = null;
    this.stopMetronome();
    for (const oscillator of this._outputs) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect();
    }
    this._outputs.clear();
    this._toneUntil = 0;
    const context = this._context;
    this._context = null;
    if (context) context.onstatechange = null;
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }

  _scheduleTone(context, frequency, start, duration, volume = 0.14) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.025, duration / 4));
    gain.gain.setValueAtTime(volume, start + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this._outputs.add(oscillator);
    oscillator.onended = () => { this._outputs.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  async playTone(frequency, duration = 1.3) {
    if (!Number.isFinite(frequency) || frequency < 20 || frequency > 10000) return;
    const context = this._ensureContext();
    await context.resume();
    if (context !== this._context) return;
    const seconds = Math.max(0.1, Math.min(5, duration));
    this._toneUntil = performance.now() + (seconds + 0.4) * 1000;
    this._scheduleTone(context, frequency, context.currentTime + 0.01, seconds);
  }

  async startMetronome(bpm = 60) {
    this.stopMetronome();
    const generation = this._metronomeGeneration;
    const context = this._ensureContext();
    await context.resume();
    if (context !== this._context || generation !== this._metronomeGeneration) return;
    const tempo = Math.max(30, Math.min(240, Number(bpm) || 60));
    let nextBeat = context.currentTime + 0.05;
    let beat = 0;
    const schedule = () => {
      if (context !== this._context || generation !== this._metronomeGeneration) return;
      // Background tabs throttle timers. Resume with one beat, never a burst.
      if (nextBeat < context.currentTime) nextBeat = context.currentTime + 0.02;
      while (nextBeat < context.currentTime + 0.1) {
        this._scheduleTone(context, beat % 4 === 0 ? 1500 : 1000, nextBeat, 0.035, 0.10);
        nextBeat += 60 / tempo;
        beat++;
      }
    };
    schedule();
    this._metronomeTimer = setInterval(schedule, 25);
  }

  stopMetronome() {
    this._metronomeGeneration++;
    if (this._metronomeTimer !== null) clearInterval(this._metronomeTimer);
    this._metronomeTimer = null;
  }
}
