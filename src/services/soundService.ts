/**
 * Web Audio API synthesizer for PINN Arcade
 * Robust, zero-dependency procedural arcade sound generator.
 * Works across desktop and mobile browsers (iOS Safari, Chrome, Firefox, Edge, Android).
 */

type MuteListener = (isMuted: boolean) => void;

class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private listeners: Set<MuteListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pinn_arcade_muted');
        // If explicitly set to 'true', respect it; otherwise default to unmuted (false)
        this.isMuted = saved === 'true';
      } catch {
        this.isMuted = false;
      }
    }
  }

  public subscribe(listener: MuteListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.isMuted);
    } catch {
      // ignore
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.isMuted);
      } catch {
        // ignore
      }
    });
  }

  /**
   * Initializes or resumes the AudioContext on user interaction
   */
  public initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (err) {
      console.warn('AudioContext initialization warning:', err);
    }

    return this.ctx;
  }

  /**
   * Universal audio unlock routine. Plays a 1-sample silent buffer node.
   * Forces iOS Safari, WebKit, and Chrome out of hardware power-saving/autoplay lock.
   */
  public unlockAudio() {
    try {
      const ctx = this.initContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Play 1-sample silent buffer to activate hardware audio output channel
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // ignore unlock warnings
    }
  }

  public getAudioContextState(): string {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('pinn_arcade_muted', String(this.isMuted));
    } catch {
      // ignore
    }

    this.notify();

    // If unmuting, unlock and play a golden confirmation chime
    if (!this.isMuted) {
      this.unlockAudio();
      this.playCoin();
    }

    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('pinn_arcade_muted', String(this.isMuted));
    } catch {
      // ignore
    }

    this.notify();

    if (!this.isMuted) {
      this.unlockAudio();
      this.playCoin();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Golden coin collection chime - crisp, shimmering 2-tone bell (B5 -> E6)
   */
  public playCoin() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.07); // E6

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio errors silenced gracefully
    }
  }

  /**
   * Upward frequency whoosh for jumping (160Hz -> 520Hz)
   */
  public playJump() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(520, now + 0.16);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // ignore
    }
  }

  /**
   * Low swoosh for ducking / sliding (280Hz -> 100Hz)
   */
  public playSlide() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.18);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // ignore
    }
  }

  /**
   * Crunchy boom on hazard impact
   */
  public playCrash() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(35, now + 0.28);

      gain.gain.setValueAtTime(0.38, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // ignore
    }
  }

  /**
   * Descending 4-tone retro arcade game-over fanfare
   */
  public playGameOver() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const notes = [440, 392, 349, 293];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.13;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.24, start);
        gain.gain.linearRampToValueAtTime(0.0001, start + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Triumphant Montego Bay victory fanfare
   */
  public playVictory() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        const dur = idx === notes.length - 1 ? 0.45 : 0.2;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.28, start);
        gain.gain.linearRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Treasure Chest opening sparkle sound
   */
  public playChest() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // Low chest creak
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(120, now);
      bassOsc.frequency.linearRampToValueAtTime(240, now + 0.15);
      bassGain.gain.setValueAtTime(0.22, now);
      bassGain.gain.linearRampToValueAtTime(0.0001, now + 0.2);
      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.2);

      // Shimmering chimes
      [784, 987, 1174, 1567].forEach((freq, i) => {
        if (!ctx) return;
        const chime = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        const startTime = now + 0.1 + i * 0.06;
        chime.type = 'sine';
        chime.frequency.setValueAtTime(freq, startTime);
        chimeGain.gain.setValueAtTime(0.2, startTime);
        chimeGain.gain.linearRampToValueAtTime(0.0001, startTime + 0.28);
        chime.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        chime.start(startTime);
        chime.stop(startTime + 0.28);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Crisp UI feedback click/tap
   */
  public playClick() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore
    }
  }

  /**
   * Snappy arcade target tap (Speed Tap)
   */
  public playTap() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(1320, now + 0.04);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // ignore
    }
  }

  /**
   * Soft miss / invalid move feedback
   */
  public playMiss() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // ignore
    }
  }
}

export const soundService = new SoundService();
