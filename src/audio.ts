export type SoundCue = 'drive' | 'dink' | 'serve' | 'bounce' | 'net' | 'miss' | 'fault' | 'point' | 'sideout' | 'win' | 'lose';

function readSetting(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function saveSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Private browsing may disable storage. */ }
}

/** Short synthesized effects, with no downloaded audio or third-party services. */
export function synthesizeCue(context: BaseAudioContext, output: AudioNode, cue: SoundCue) {
  const now = context.currentTime;
  function tone(frequency: number, end: number, duration: number, level: number, delay = 0, type: OscillatorType = 'sine') {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + delay + duration);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(level, now + delay + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    oscillator.connect(gain); gain.connect(output);
    oscillator.start(now + delay); oscillator.stop(now + delay + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  if (cue === 'drive' || cue === 'serve') {
    tone(730, 180, 0.085, 0.22, 0, 'triangle'); tone(1850, 650, 0.035, 0.08);
  } else if (cue === 'dink') tone(530, 290, 0.11, 0.17, 0, 'triangle');
  else if (cue === 'bounce') tone(260, 95, 0.08, 0.13);
  else if (cue === 'net') { tone(120, 65, 0.14, 0.12, 0, 'triangle'); tone(310, 90, 0.09, 0.05); }
  else if (cue === 'miss') tone(620, 200, 0.09, 0.045);
  else if (cue === 'fault') tone(190, 145, 0.15, 0.09, 0, 'triangle');
  else if (cue === 'sideout') { tone(420, 420, 0.12, 0.10); tone(560, 560, 0.13, 0.09, 0.12); }
  else if (cue === 'point') { tone(660, 660, 0.12, 0.10); tone(880, 880, 0.18, 0.09, 0.10); }
  else if (cue === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.23, 0.10, i * 0.13));
  else [392, 330, 262].forEach((f, i) => tone(f, f, 0.23, 0.09, i * 0.15));
}

export class GameAudio {
  enabled = readSetting('pickleball.sound') !== 'off';
  volume = 0.35;
  available = typeof AudioContext !== 'undefined';
  private context?: AudioContext;
  private master?: GainNode;
  private paused = false;
  constructor() {
    const stored = readSetting('pickleball.volume');
    if (stored !== null && Number.isFinite(Number(stored))) this.volume = Math.max(0, Math.min(1, Number(stored)));
  }
  /** Call only in a click/key handler to respect browser autoplay restrictions. */
  unlock() {
    if (!this.available || !this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.gain.value = this.paused ? 0 : this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => { this.available = false; });
    } catch { this.available = false; }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled; saveSetting('pickleball.sound', enabled ? 'on' : 'off');
    if (enabled) this.unlock();
    this.updateGain();
  }
  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume)); saveSetting('pickleball.volume', String(this.volume)); this.updateGain();
  }
  setPaused(paused: boolean) { this.paused = paused; this.updateGain(); }
  private updateGain() {
    if (!this.context || !this.master) return;
    const gain = this.enabled && !this.paused ? this.volume : 0;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(gain, this.context.currentTime, 0.015);
  }
  play(cue: SoundCue) {
    if (!this.enabled || this.paused || !this.available || !this.context || !this.master || this.context.state !== 'running' || this.volume === 0) return;
    try { synthesizeCue(this.context, this.master, cue); } catch { this.available = false; }
  }
}
