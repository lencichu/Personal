// Efectos de sonido sintetizados con Web Audio (sin archivos de audio: todo
// se genera en el momento con osciladores y ruido filtrado). El AudioContext
// se crea recien al primer sonido, porque los navegadores lo bloquean hasta
// que hay un gesto del usuario de por medio (el primer toque en pantalla).
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ctx() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      this.ctx = new AudioCtor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  _envelope(gainNode, ctx, startTime, attack, decay, peak) {
    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peak, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attack + decay);
  }

  _noiseBurst(ctx, startTime, duration, peakGain, filterFreq) {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  _crowdSwell(ctx, startTime, duration, peakGain) {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.3);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // Golpe de pie contra la pelota: tono grave con caida rapida + un
  // chasquido corto de ruido para dar sensacion de impacto.
  kick() {
    const ctx = this._ctx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.09);

    const gain = ctx.createGain();
    this._envelope(gain, ctx, now, 0.002, 0.11, 0.5);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    this._noiseBurst(ctx, now, 0.035, 0.22, 2200);
  }

  // Fanfarria corta ascendente + un "rugido" de tribuna de fondo.
  goal() {
    const ctx = this._ctx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      this._envelope(gain, ctx, t, 0.01, 0.22, 0.2);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });

    this._crowdSwell(ctx, now + 0.05, 0.9, 0.16);
  }

  // Lo mismo que el gol pero mas brillante y con mas tribuna, para la
  // celebracion de racha de goles seguidos.
  combo() {
    const ctx = this._ctx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [659.25, 783.99, 987.77, 1318.5]; // E5 G5 B5 E6
    notes.forEach((freq, i) => {
      const t = now + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      this._envelope(gain, ctx, t, 0.008, 0.2, 0.24);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });

    this._crowdSwell(ctx, now, 1.1, 0.22);
  }

  // Tono descendente corto para parada / afuera / bloqueado: un "fallaste"
  // breve, sin ser punitivo.
  miss() {
    const ctx = this._ctx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);

    const gain = ctx.createGain();
    this._envelope(gain, ctx, now, 0.004, 0.26, 0.16);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Click breve para botones del menu.
  tap() {
    const ctx = this._ctx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    const gain = ctx.createGain();
    this._envelope(gain, ctx, now, 0.002, 0.06, 0.12);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}
