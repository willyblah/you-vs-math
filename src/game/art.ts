import Phaser from 'phaser';
import { notation } from '../math/evaluate';

export const INK = 0xebece8;
export const MUTED = 0x565d62;
export const MATH_FONT = '"STIX Two Math", Georgia, serif';
export const UI_FONT = '"Manrope Variable", sans-serif';

export function text(scene: Phaser.Scene, x: number, y: number, value: string, size = 22, color = '#ebece8', math = true): Phaser.GameObjects.Text {
  if (size <= 12) size = Math.max(12, size + 2);
  return scene.add.text(x, y, value, { fontFamily: math ? MATH_FONT : UI_FONT, fontSize: `${size}px`, color, resolution: 2 }).setOrigin(.5);
}

export class Formula extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, source: string, size = 36, color = '#ebece8') {
    super(scene, x, y);
    scene.add.existing(this);
    let euler: [string, string] | undefined;
    if (source.startsWith('e^(')) {
      let depth = 1, end = 3;
      for (; end < source.length; end++) { if (source[end] === '(') depth++; if (source[end] === ')' && --depth === 0) break; }
      if (depth === 0) euler = [source.slice(3, end).replace(/^i\*\((.*)\)$/, 'i$1'), source.slice(end + 1)];
    }
    if (euler) {
      const base = text(scene, 0, 0, 'e', size, color);
      const exponent = text(scene, size * .45, -size * .44, notation(euler[0]), size * .48, color).setOrigin(0, .5);
      this.add([base, exponent]);
      if (euler[1]) this.add(text(scene, size * .5 + exponent.width + 8, 0, notation(euler[1]), size * .65, color).setOrigin(0, .5));
    } else if (/^-?\d+\/\d+$/.test(source)) {
      const [n, d] = source.split('/');
      this.add(text(scene, 0, -size * .3, n, size * .55, color));
      this.add(text(scene, 0, size * .36, d, size * .55, color));
      const line = scene.add.graphics().lineStyle(1.3, Phaser.Display.Color.HexStringToColor(color).color).lineBetween(-size * .3, 1, size * .3, 1);
      this.add(line);
    } else this.add(text(scene, 0, 0, notation(source), size, color));
  }
}

export interface FigurePose { time: number; speed: number; grounded: boolean; facing: number; held: boolean; attack: number; hurt: boolean; aim: number }
export function drawFigure(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, pose: FigurePose, scale = 1): void {
  const { time, speed, grounded, facing, held, attack, hurt, aim } = pose;
  const run = Math.min(1, Math.abs(speed) / 240), swing = Math.sin(time * 15) * run;
  const bob = grounded ? Math.abs(Math.sin(time * 15)) * 2.5 * run : -2;
  const point = (px: number, py: number) => ({ x: x + px * scale, y: y + (py + bob) * scale });
  const line = (...points: number[]) => {
    g.beginPath();
    for (let i = 0; i < points.length; i += 2) { const p = point(points[i], points[i + 1]); if (!i) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }
    g.strokePath();
    for (let i = 0; i < points.length; i += 2) { const p = point(points[i], points[i + 1]); g.fillCircle(p.x, p.y, 2.2 * scale); }
  };
  g.lineStyle(4.4 * scale, hurt ? INK : color, 1); g.fillStyle(hurt ? INK : color, 1);
  const lean = grounded ? facing * run * 4 : facing * 3;
  const head = point(lean, -26);
  g.strokeCircle(head.x, head.y, 9 * scale);
  line(lean, -16, 0, 8);
  if (grounded) {
    line(0, 8, swing * 10, 19, swing * 20 + 4, 32);
    line(0, 8, -swing * 10, 20, -swing * 20 - 4, 32);
  } else { line(0, 8, -facing * 12, 16, -facing * 8, 29); line(0, 8, facing * 10, 9, facing * 18, 23); }
  if (attack > 0) {
    line(lean, -10, facing * 18, -12, facing * 34, -10);
    line(lean, -9, -facing * 10, 1, -facing * 17, -4);
  } else if (held) {
    const ax = Math.cos(aim) * 25, ay = Math.sin(aim) * 25 - 10;
    line(lean, -10, ax * .5, ay * .5 - 4, ax, ay);
    line(lean, -8, ax * .45, ay * .5 + 7, ax - facing * 5, ay + 5);
  } else {
    line(lean, -10, -swing * 11 - facing * 3, 1, -swing * 17 - facing * 4, 8);
    line(lean, -10, swing * 11 + facing * 5, -1, swing * 17 + facing * 7, -6);
  }
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: number }
export class Dust {
  private particles: Particle[] = [];
  constructor(private g: Phaser.GameObjects.Graphics) {}
  burst(x: number, y: number, color: number, count = 16, force = 150): void {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2, speed = force * (.25 + Math.random());
      const life = .25 + Math.random() * .6;
      this.particles.push({ x, y, vx: Math.cos(theta) * speed, vy: Math.sin(theta) * speed, life, max: life, size: 1 + Math.random() * 2.5, color });
    }
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
  }
  update(dt: number): void {
    this.g.clear();
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 75 * dt;
      this.g.fillStyle(p.color, Math.max(0, p.life / p.max)).fillRect(p.x, p.y, p.size, p.size);
    }
  }
}
