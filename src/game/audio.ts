import type { Settings } from './types';

export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private musicTimer = 0;
  private note = 0;
  constructor(public settings: Settings) {}
  start(): void {
    this.context ??= new AudioContext();
    if (!this.master) { this.master = this.context.createGain(); this.master.connect(this.context.destination); }
    this.master.gain.value = this.settings.sound ? this.settings.volume * .28 : 0;
    void this.context.resume();
  }
  configure(settings: Settings): void {
    this.settings = settings;
    if (this.master) this.master.gain.value = settings.sound ? settings.volume * .28 : 0;
  }
  tone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = .22, end?: number): void {
    if (!this.context || !this.master || !this.settings.sound) return;
    const now = this.context.currentTime, oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    if (end) oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    envelope.gain.setValueAtTime(.0001, now); envelope.gain.exponentialRampToValueAtTime(gain, now + .012); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(envelope); envelope.connect(this.master); oscillator.start(now); oscillator.stop(now + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  play(event: 'grab' | 'throw' | 'jump' | 'hit' | 'solve' | 'wrong' | 'damage' | 'unlock' | 'boss'): void {
    const sounds: Record<typeof event, [number, number, OscillatorType, number, number]> = {
      grab: [540, .13, 'sine', .2, 720], throw: [240, .14, 'triangle', .22, 80], jump: [180, .12, 'sine', .12, 300],
      hit: [100, .14, 'triangle', .5, 35], solve: [440, .8, 'sine', .25, 880], wrong: [160, .22, 'triangle', .15, 140],
      damage: [130, .22, 'sawtooth', .17, 45], unlock: [330, 1.3, 'sine', .32, 1320], boss: [60, 1.2, 'triangle', .3, 40],
    };
    this.tone(...sounds[event]);
    if (event === 'solve' || event === 'unlock') { this.tone(660, 1.1, 'sine', .1); this.tone(880, 1.5, 'sine', .06); }
  }
  update(dt: number, chapter: number, combat: boolean): void {
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = combat ? .6 : 2.6;
    const sequence = [0, 7, 12, 14, 7, 3, 10, 7];
    const frequency = 110 * Math.pow(2, (sequence[this.note++ % sequence.length] + (chapter - 1) * 2) / 12);
    this.tone(frequency, combat ? .5 : 3.5, 'sine', combat ? .09 : .18);
    if (combat && this.note % 2 === 0) this.tone(46, .16, 'triangle', .24, 22);
  }
}
