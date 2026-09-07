import Phaser from 'phaser';
import { drawFigure, Formula, INK, text } from './art';

export class Backdrop extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private formula!: Formula;
  private one!: Formula;
  private elapsed = 0;
  constructor() { super('Backdrop'); }
  create(): void {
    this.art = this.add.graphics();
    this.formula = new Formula(this, 1000, 293, 'e^(iπ)', 90).setAlpha(.95);
    this.one = new Formula(this, 794, 386, '1', 64, '#ff962f');
    text(this, 928, 582, 'A WORLD WAITING TO BE SOLVED', 9, '#94a2ad', false).setLetterSpacing(3);
    text(this, 1210, 393, 'Re', 15, '#94a2ad');
    text(this, 946, 139, 'Im', 15, '#94a2ad');
    text(this, 1109, 475, 'π', 20, '#94a2ad');
  }
  update(_time: number, delta: number): void {
    this.elapsed += delta / 1000;
    const t = this.elapsed, g = this.art.clear();
    g.fillStyle(0x090b0d).fillRect(0, 0, 1280, 720);
    g.lineStyle(1, 0x64707c, .055);
    for (let x = 0; x < 1280; x += 64) g.lineBetween(x, 0, x, 720);
    for (let y = 0; y < 720; y += 64) g.lineBetween(0, y, 1280, y);
    const cx = 946, cy = 367, r = 195;
    g.lineStyle(1, INK, .12).strokeCircle(cx, cy, r);
    g.lineStyle(1, INK, .05).strokeCircle(cx, cy, r + 38);
    g.lineStyle(1, INK, .16).lineBetween(675, cy, 1220, cy).lineBetween(cx, 143, cx, 580);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      g.lineStyle(1, INK, .13).lineBetween(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
    }
    const angle = -t * .16 - .65;
    const px = cx + Math.cos(angle) * r, py = cy + Math.sin(angle) * r;
    g.lineStyle(1, INK, .22).lineBetween(cx, cy, px, py);
    g.fillStyle(INK, .9).fillCircle(px, py, 3.5);
    g.lineStyle(1, 0xff962f, .3).beginPath().arc(cx, cy, r, angle, angle + .45).strokePath();
    g.lineStyle(1, INK, .24).lineBetween(698, 505, 1159, 505);
    g.lineStyle(1, INK, .05).lineBetween(698, 506, 1159, 506);
    drawFigure(g, 778, 423, 0xff962f, { time: t, speed: 0, grounded: false, facing: 1, held: true, attack: 0, hurt: false, aim: -.9 + Math.sin(t) * .04 }, 2.4);
    this.one.setPosition(849 + Math.sin(t * .7) * 3, 353 + Math.cos(t * .9) * 5);
    this.formula.y = 289 + Math.sin(t * .8) * 9;
    g.lineStyle(1, 0xff962f, .22);
    for (let i = 0; i < 16; i++) {
      const x = 855 + i * 10, y = 352 - Math.sin(i / 16 * Math.PI) * 42;
      g.fillStyle(0xff962f, .1 + i / 16 * .25).fillCircle(x, y, 1);
    }
    for (let i = 0; i < 20; i++) {
      const x = 678 + (i * 37.7 % 540), y = 180 + (i * 51.3 + t * (i % 3 + 1)) % 360;
      g.fillStyle(INK, .1 + Math.sin(t + i) * .05).fillRect(x, y, 1, 1);
    }
  }
}
