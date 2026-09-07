export type CharacterId = 'orange' | 'green' | 'yellow' | 'blue' | 'red';
export interface Character {
  id: CharacterId; name: string; color: number; hex: string; trait: string; description: string;
  speed: number; jump: number; focus: number; handling: number; force: number; timing: number;
}
export const CHARACTERS: Character[] = [
  { id: 'orange', name: 'Orange', color: 0xff962f, hex: '#ff962f', trait: 'A little more possibility.', description: 'Balanced movement. Longer focus while shaping equations.', speed: 1, jump: 1, focus: 6, handling: 1, force: 1, timing: 1 },
  { id: 'green', name: 'Green', color: 0x83db86, hex: '#83db86', trait: 'Everything in its own time.', description: 'Wider counter windows. More precise throws.', speed: 1, jump: 1, focus: 4, handling: 1, force: 1, timing: 1.25 },
  { id: 'yellow', name: 'Yellow', color: 0xf4d76b, hex: '#f4d76b', trait: 'See what comes next.', description: 'See complete trajectories and previews of equation effects.', speed: 1, jump: 1, focus: 4, handling: 1, force: 1, timing: 1 },
  { id: 'blue', name: 'Blue', color: 0x72baff, hex: '#72baff', trait: 'Stay one step ahead.', description: 'Faster running, higher jumps, and quicker symbol handling.', speed: 1.12, jump: 1.08, focus: 4, handling: 1.25, force: 1, timing: 1 },
  { id: 'red', name: 'Red', color: 0xf27479, hex: '#f27479', trait: 'Make yourself an impact.', description: 'Stronger throws and melee knockback.', speed: 1, jump: 1, focus: 4, handling: 1, force: 1.35, timing: 1 },
];
export type EffectKind = 'extend' | 'stack' | 'launch' | 'remove' | 'reverse' | 'power' | 'rotate' | 'orbit' | 'wave' | 'split' | 'sum' | 'derivative' | 'integral' | 'identity';
export type SlotType = 'value' | 'operator' | 'angle' | 'function';
export interface RailSpec {
  label: string; slots: SlotType[]; initial?: (string | null)[]; prefix?: string; suffix?: string;
  effect: EffectKind; target: number; imaginary?: number; hint: string; example: string;
}
export interface Beat {
  name: string; objective: string; rail: RailSpec; layout: 'gap' | 'stairs' | 'tower' | 'arena' | 'orbit' | 'waves';
  enemies?: number; hazard?: 'bolts' | 'negative' | 'vectors' | 'waves'; intro?: string; unlock?: string[];
}
export interface BossPhase extends Beat {
  component: string; attack: string; counter: string; hits: number;
}
export interface Encounter {
  id: string; chapter: number; title: string; subtitle: string; kind: 'puzzle' | 'action' | 'boss';
  duration: number; unlock: string[]; beats: Beat[]; phases?: BossPhase[];
}
export interface CheckpointState {
  version: 1; character: CharacterId; encounter: number; beat: number; furthest: number; unlocked: string[]; complete: boolean; elapsed: number;
}
export interface Settings { sound: boolean; reducedMotion: boolean; volume: number }
export type GameEvent =
  | { type: 'hud'; hp: number; focus: number; maxFocus: number; held: string | null; objective: string; chapter: number; title: string; phase: string; progress: number }
  | { type: 'toast'; text: string; sub?: string }
  | { type: 'chapter'; chapter: number; title: string; subtitle: string }
  | { type: 'pause' }
  | { type: 'death' }
  | { type: 'complete'; elapsed: number }
  | { type: 'save'; save: CheckpointState };
