import Phaser from 'phaser';
import { CAMPAIGN, CHAPTERS, unlockedThrough } from '../content/campaign';
import { equal, evaluate, notation } from '../math/evaluate';
import { AudioEngine } from './audio';
import { drawFigure, Dust, Formula, INK, MUTED, text } from './art';
import { compatible, Rack, Rail, Token } from './objects';
import { CHARACTERS, type Beat, type BossPhase, type Character, type CheckpointState, type Encounter, type GameEvent, type Settings } from './types';

export interface RuntimeArgs { save: CheckpointState; settings: Settings; audio: AudioEngine; emit: (event: GameEvent) => void; chapterCard?: boolean }
interface Platform {
  rect: Phaser.GameObjects.Rectangle; body: Phaser.Physics.Arcade.StaticBody; width: number; height: number;
  baseX: number; baseY: number; motion?: 'orbit' | 'wave' | 'lift'; phase: number; amplitude: number;
}
interface Enemy { rect: Phaser.GameObjects.Rectangle; body: Phaser.Physics.Arcade.Body; glyph: Formula; hp: number; base: number; time: number; stun: number; kind: 'cluster' | 'operator' }
interface Bolt { x: number; y: number; vx: number; vy: number; glyph: Formula; age: number; kind: string; friendly: boolean; wave: number }
interface Warning { x: number; y: number; tx: number; ty: number; timer: number; total: number; kind: string; glyph: Phaser.GameObjects.Text }
interface Pulse { start: Phaser.Math.Vector2; end: Phaser.Math.Vector2; via: Phaser.Math.Vector2; age: number; duration: number; glyph: Formula; trail: Phaser.Math.Vector2[]; boss: boolean }

export class Gameplay extends Phaser.Scene {
  args!: RuntimeArgs;
  save!: CheckpointState;
  character!: Character;
  encounter!: Encounter;
  beat!: Beat;
  phase?: BossPhase;
  player!: Phaser.GameObjects.Rectangle;
  playerBody!: Phaser.Physics.Arcade.Body;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  platforms: Platform[] = [];
  tokens: Token[] = [];
  racks: Rack[] = [];
  enemies: Enemy[] = [];
  bolts: Bolt[] = [];
  warnings: Warning[] = [];
  pulses: Pulse[] = [];
  rail!: Rail;
  held: Token | null = null;
  background!: Phaser.GameObjects.Graphics;
  geometry!: Phaser.GameObjects.Graphics;
  figures!: Phaser.GameObjects.Graphics;
  overlay!: Phaser.GameObjects.Graphics;
  dust!: Dust;
  hint!: Phaser.GameObjects.Text;
  bossFormula?: Formula;
  bossLabel?: Phaser.GameObjects.Text;
  cameo?: Formula;
  portal!: Phaser.GameObjects.Container;
  clock = 0; worldClock = 0; hp = 3; focus = 4; invulnerable = 0; attack = 0; handling = 0; coyote = 0; jumpBuffer = 0; vy = 0; vx = 0; facing = 1;
  solved = false; dying = false; transition = false; attackTimer = 4; hudTimer = 0; editTimer = 0; hitCount = 0; bossStun = 0; completedTimer = 0; ending = false;
  worldWidth = 2300; goalX = 2160; launched = false; shield = 0; effectMagnitude = 0; effectAngle = 0; counterLock = 0; meleeQueue = false; focusWasActive = false;
  standing?: Platform;
  private introSafe = 0;
  private pauseDebounce = 0;
  private devicePlatforms: Platform[] = [];
  private deviceActive = false;

  constructor() { super('Gameplay'); }
  init(args: RuntimeArgs): void { this.args = args; this.save = { ...args.save, unlocked: [...args.save.unlocked] }; }
  create(): void {
    this.character = CHARACTERS.find(c => c.id === this.save.character)!;
    this.encounter = CAMPAIGN[this.save.encounter];
    this.phase = this.encounter.phases?.[this.save.beat];
    this.beat = this.phase ?? this.encounter.beats[this.save.beat];
    this.platforms = []; this.tokens = []; this.racks = []; this.enemies = []; this.bolts = []; this.warnings = []; this.pulses = [];
    this.held = null; this.standing = undefined; this.bossFormula = undefined; this.bossLabel = undefined; this.cameo = undefined;
    this.devicePlatforms = []; this.deviceActive = false;
    this.clock = this.worldClock = this.attack = this.invulnerable = this.handling = this.coyote = this.jumpBuffer = this.vy = this.vx = this.hitCount = this.hudTimer = this.editTimer = this.completedTimer = this.shield = this.effectMagnitude = this.effectAngle = this.counterLock = this.bossStun = 0;
    this.facing = 1; this.hp = 3; this.focus = this.character.focus; this.pauseDebounce = .25;
    this.solved = this.dying = this.transition = this.launched = this.ending = this.meleeQueue = this.focusWasActive = false;
    this.attackTimer = this.phase ? 4.5 : 6; this.introSafe = this.beat.unlock?.length ? 9 : 3;
    this.worldWidth = this.phase ? 1280 : 2300; this.goalX = this.worldWidth - 145;
    this.save.unlocked = unlockedThrough(this.save.encounter, this.save.beat);
    this.physics.world.setBounds(0, -400, this.worldWidth, 1600);
    this.cameras.main.setBounds(0, -70, this.worldWidth, 820).setBackgroundColor('#090b0d');
    this.background = this.add.graphics().setDepth(-10);
    this.geometry = this.add.graphics().setDepth(1);
    this.figures = this.add.graphics().setDepth(15);
    this.overlay = this.add.graphics().setDepth(20);
    this.dust = new Dust(this.add.graphics().setDepth(30));
    this.drawBackdrop();
    this.buildArena();
    this.player = this.add.rectangle(100, 563, 24, 62, 0xffffff, 0).setDepth(10);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setMaxVelocity(1800, 3200);
    for (const platform of this.platforms) this.collidePlayer(platform);
    if (!this.phase) this.cameras.main.startFollow(this.player, false, .09, .09, -190, 50);
    this.keys = this.input.keyboard!.addKeys('A,D,LEFT,RIGHT,SPACE,E,F,R,ESC,H,Q') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (pointer.leftButtonDown()) this.meleeQueue = true; });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.cycleRack(dy > 0 ? 1 : -1));
    this.hint = text(this, 640, 663, '', 12, '#bac1c5', false).setScrollFactor(0).setDepth(60);
    if (this.phase) this.buildBoss();
    else for (let i = 0; i < (this.beat.enemies ?? 0); i++) this.spawnEnemy(790 + i * 330, 570, i);
    if (!this.phase && this.beat.hazard && this.encounter.chapter >= 2) this.cameo = new Formula(this, 1030, 230, 'e^(iπ)', 47, '#aab1b5').setDepth(4);
    if (!this.args.settings.reducedMotion) {
      this.cameras.main.setZoom(this.phase ? .94 : 1.04);
      this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 1900, ease: 'Sine.easeInOut' });
    }
    if (this.args.chapterCard) {
      const chapter = CHAPTERS[this.encounter.chapter - 1];
      this.args.emit({ type: 'chapter', chapter: this.encounter.chapter, title: chapter.title, subtitle: chapter.subtitle });
    } else this.args.emit({ type: 'toast', text: this.beat.name, sub: this.beat.intro ?? this.beat.objective });
    this.commitSave();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.removeAllListeners(); });
    this.updateHud();
  }

  private buildArena(): void {
    if (this.phase) {
      this.platform(640, 628, 1280, 20);
      this.platform(180, 433, 150, 10); this.platform(1080, 447, 170, 10);
    } else {
      this.platform(475, 628, 950, 20);
      this.platform(1920, 628, 760, 20);
      this.platform(915, 535, 90, 10);
      this.platform(1630, 525, 130, 10);
      if (this.beat.layout === 'tower') {
        this.platform(1810, 467, 160, 10); this.platform(1980, 370, 160, 10);
        this.goalX = 2110; this.platform(this.goalX, 350, 180, 12);
      }
      if (this.beat.layout === 'stairs') {
        this.platform(1770, 468, 100, 10); this.platform(1930, 408, 140, 10);
        this.goalX = 2110; this.platform(this.goalX, 380, 180, 12);
      }
    }
    this.rail = new Rail(this, this.phase ? 650 : 655, 536, this.beat.rail, this.character.color);
    this.makeRacks();
    if (this.save.encounter === 0 && this.save.beat === 0) {
      this.racks.forEach(r => r.container.setVisible(false));
      const one = this.spawnToken('1', 330, 475); one.body.setGravityY(0); one.body.setVelocityY(-8);
      this.tweens.add({ targets: one.collider, y: 460, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const exitY = ['tower', 'stairs'].includes(this.beat.layout) ? (this.beat.layout === 'tower' ? 350 : 380) : 628;
    const g = this.add.graphics().lineStyle(1, MUTED, .8).strokeRect(-23, -70, 46, 70);
    const arrow = text(this, 0, -35, '→', 26, '#8c9ba6');
    const label = text(this, 0, 22, 'CONTINUE', 9, '#a0adb6', false).setLetterSpacing(2);
    this.portal = this.add.container(this.goalX, exitY - 10, [g, arrow, label]).setAlpha(this.phase ? 0 : .5);
    if (this.encounter.chapter >= 3 && !this.phase) {
      text(this, 1250, 135, this.beat.layout === 'waves' ? 'y = sin(x + t)' : 'ℂ', 42, '#8999a5');
      text(this, 1260, 670, 'Re', 18, '#98a7b2'); text(this, 1015, 215, 'Im', 18, '#98a7b2');
    }
    if (this.encounter.chapter >= 3) {
      const cx = this.phase ? 955 : 1240, cy = this.phase ? 242 : 395;
      text(this, cx, cy - 164, 'π/2', 14, '#98a7b2'); text(this, cx - 166, cy, 'π', 14, '#98a7b2');
      text(this, cx, cy + 168, '3π/2', 14, '#98a7b2'); text(this, cx + 171, cy, '0, 2π', 13, '#98a7b2');
    }
  }

  private makeRacks(): void {
    const unlocked = this.save.unlocked;
    const groups: [string, string[]][] = [
      ['numbers', unlocked.filter(t => /^-?\d+$/.test(t))],
      ['operators', unlocked.filter(t => ['+', '-', '*', '/', '^'].includes(t))],
      ['directions', unlocked.filter(t => t === 'i' || t.includes('π') && !/sin|cos/.test(t))],
      ['functions', unlocked.filter(t => /sin|cos|sum|diff|integral/.test(t))],
    ];
    const visible = groups.filter(([, values]) => values.length);
    visible.forEach(([name, choices], i) => this.racks.push(new Rack(this, 175 + i * 105, 557, choices, name)));
  }

  private platform(x: number, y: number, width: number, height: number, motion?: Platform['motion'], phase = 0, amplitude = 40): Platform {
    const rect = this.add.rectangle(x, y, width, height, 0x161b1e, .96);
    this.physics.add.existing(rect, true);
    const platform = { rect, body: rect.body as Phaser.Physics.Arcade.StaticBody, width, height, baseX: x, baseY: y, motion, phase, amplitude };
    this.platforms.push(platform);
    if (this.player?.active) this.collidePlayer(platform);
    return platform;
  }
  private collidePlayer(p: Platform): void {
    this.physics.add.collider(this.player, p.rect, () => { if (this.playerBody.blocked.down && Math.abs(this.playerBody.bottom - p.body.top) < 8) this.standing = p; });
  }
  private spawnToken(source: string, x: number, y: number): Token {
    const token = new Token(this, source, x, y); this.tokens.push(token);
    this.platforms.forEach(p => this.physics.add.collider(token.collider, p.rect));
    return token;
  }
  private discardToken(token: Token): void {
    this.tweens.killTweensOf(token.collider);
    token.destroy(); this.tokens = this.tokens.filter(t => t !== token);
    if (this.held === token) this.held = null;
  }
  private spawnEnemy(x: number, y: number, index: number): void {
    const rect = this.add.rectangle(x, y, 37, 38, 0xffffff, 0);
    this.physics.add.existing(rect);
    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(1100).setBounce(.1, 0).setMaxVelocity(650, 1000);
    const enemy: Enemy = { rect, body, glyph: new Formula(this, x, y, index % 2 ? '−1' : '2³', 38, '#d6d9d7'), hp: 2, base: x, time: index, stun: 0, kind: index % 2 ? 'operator' : 'cluster' };
    this.enemies.push(enemy);
    this.platforms.forEach(p => this.physics.add.collider(rect, p.rect));
    this.physics.add.overlap(this.player, rect, () => { if (enemy.stun <= 0) this.damage(enemy.rect.x); });
  }

  private buildBoss(): void {
    this.bossFormula = this.makeBossFormula(this.phase!.component, this.encounter.chapter === 5 ? 48 : 65);
    this.bossLabel = text(this, 965, 326, this.phase!.attack, 10, '#91999f', false).setLetterSpacing(4);
    this.args.audio.play('boss');
  }
  private makeBossFormula(source: string, size: number): Formula {
    const formula = new Formula(this, 0, 235, source, size).setDepth(8);
    formula.setScale(Math.min(1, 560 / formula.getBounds().width));
    formula.x += 940 - formula.getBounds().centerX;
    return formula;
  }
  private drawBackdrop(): void {
    const g = this.background;
    g.fillStyle(0x090b0d).fillRect(0, -400, this.worldWidth, 1500);
    const chapter = this.encounter.chapter;
    g.lineStyle(1, 0x66717b, chapter >= 3 ? .1 : .035);
    for (let x = 0; x < this.worldWidth; x += 80) g.lineBetween(x, -200, x, 1000);
    for (let y = -160; y < 1000; y += 80) g.lineBetween(0, y, this.worldWidth, y);
    if (chapter >= 3) {
      g.lineStyle(1, 0xa9b2b9, .18).lineBetween(0, 480, this.worldWidth, 480).lineBetween(1020, 0, 1020, 900);
      for (let x = 60; x < this.worldWidth; x += 160) text(this, x, 497, String((x - 1020) / 160), 12, '#8999a5');
    }
    text(this, 90, 188, `${String(this.save.encounter + 1).padStart(2, '0')} / ${String(CAMPAIGN.length).padStart(2, '0')}`, 11, '#98a7b2', false).setOrigin(0).setLetterSpacing(3);
    text(this, 90, 218, this.beat.name, 31, '#adb5b9', false).setOrigin(0);
    if (!this.phase) text(this, 90, 270, this.beat.intro?.startsWith('e^') ? 'A disturbance in the notation.' : this.encounter.subtitle, 13, '#a1aeb7', false).setOrigin(0);
  }

  private aim(): number {
    const pointer = this.input.activePointer; const point = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return Phaser.Math.Angle.Between(this.player.x, this.player.y - 10, point.x, point.y);
  }
  private nearbyRack(): Rack | undefined {
    const pointer = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const near = this.racks.filter(r => r.container.visible && Phaser.Math.Distance.Between(this.player.x, this.player.y, r.x, r.y) < 115);
    return near.sort((a, b) => Phaser.Math.Distance.Between(pointer.x, pointer.y, a.x, a.y) - Phaser.Math.Distance.Between(pointer.x, pointer.y, b.x, b.y))[0];
  }
  private nearRail(): boolean { return Phaser.Math.Distance.Between(this.player.x, this.player.y, this.rail.x, this.rail.y) < 215; }
  private cycleRack(direction: number): void {
    const rack = this.nearbyRack();
    if (rack) { rack.cycle(direction); this.args.audio.play('grab'); }
  }
  private selectedSlot(): number {
    const pointer = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const pointed = this.rail.slotAt(pointer.x, pointer.y);
    if (pointed >= 0) return pointed;
    if (this.held) {
      const empty = this.rail.values.findIndex((v, i) => v === null && compatible(this.held!.source, this.rail.spec.slots[i]));
      if (empty >= 0) return empty;
    }
    return this.rail.slotPositions.reduce((best, x, i) => Math.abs(this.player.x - this.rail.x - x) < Math.abs(this.player.x - this.rail.x - this.rail.slotPositions[best]) ? i : best, 0);
  }

  private interact(): void {
    if (this.handling > 0 || this.transition || this.dying) return;
    this.handling = .2 / this.character.handling;
    if (this.nearRail()) {
      const slot = this.selectedSlot();
      if (this.held) {
        const old = this.rail.insert(this.held.source, slot);
        if (old === undefined) { this.args.audio.play('wrong'); this.rail.status.setText('This symbol needs a different slot.'); return; }
        this.dust.burst(this.rail.x + this.rail.slotPositions[slot], this.rail.y, this.character.color, 8, 70);
        this.discardToken(this.held);
        if (old) { this.held = this.spawnToken(old, this.player.x, this.player.y); this.held.hold(); }
        this.editTimer = .8; this.args.audio.play('grab'); return;
      }
      const source = this.rail.remove(slot);
      if (source) { this.held = this.spawnToken(source, this.player.x, this.player.y); this.held.hold(); this.editTimer = .8; this.args.audio.play('grab'); return; }
    }
    if (this.held) { this.held.release(this.player.x + this.facing * 37, this.player.y, this.facing * 35, -30); this.held = null; return; }
    const nearest = this.tokens.filter(t => t.state !== 'held' && Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) < 86).sort((a, b) => Math.abs(this.player.x - a.x) - Math.abs(this.player.x - b.x))[0];
    if (nearest) { this.tweens.killTweensOf(nearest.collider); nearest.hold(); this.held = nearest; this.args.audio.play('grab'); return; }
    const rack = this.nearbyRack();
    if (rack) {
      this.held = this.spawnToken(rack.source, this.player.x, this.player.y); this.held.hold(); this.args.audio.play('grab');
    }
  }

  private strikeOrThrow(): void {
    if (this.handling > 0 || this.dying || this.transition) return;
    const angle = this.aim(); this.facing = Math.cos(angle) < 0 ? -1 : 1;
    if (this.held) {
      const throwAngle = this.character.id === 'green' ? Math.round(angle / (Math.PI / 36)) * Math.PI / 36 : angle;
      const force = 660 * this.character.force;
      this.held.release(this.player.x + Math.cos(throwAngle) * 40, this.player.y - 10 + Math.sin(throwAngle) * 30, Math.cos(throwAngle) * force, Math.sin(throwAngle) * force);
      this.held = null; this.handling = .24 / this.character.handling; this.args.audio.play('throw');
    } else {
      if (this.attack > 0) return;
      this.attack = .28; this.handling = .3; this.args.audio.play('hit');
      this.dust.burst(this.player.x + this.facing * 45, this.player.y - 5, this.character.color, 5, 70);
      for (const enemy of this.enemies) if (Math.abs(enemy.rect.y - this.player.y) < 70 && (enemy.rect.x - this.player.x) * this.facing > -10 && (enemy.rect.x - this.player.x) * this.facing < 98) this.hitEnemy(enemy, this.facing * (this.character.id === 'red' ? 600 : 400), 1);
      for (const token of this.tokens) if (token.state !== 'held' && Phaser.Math.Distance.Between(this.player.x + this.facing * 35, this.player.y, token.x, token.y) < 80) token.release(token.x, token.y, this.facing * 420 * this.character.force, -180);
      for (const bolt of this.bolts) if (bolt.kind === 'bolts' && Phaser.Math.Distance.Between(this.player.x + this.facing * 40, this.player.y, bolt.x, bolt.y) < 85) { bolt.vx = this.facing * Math.abs(bolt.vx); bolt.friendly = true; }
    }
  }

  private evaluateRail(): void {
    if (!this.nearRail() || this.rail.cooldown > 0 || this.transition || this.dying) return;
    const { result, spec } = this.rail;
    if (!result.valid) { this.args.audio.play('wrong'); return; }
    this.editTimer = 1;
    const value = result.value!;
    const requirement = ({ sum: 'sum(', derivative: 'diff(', integral: 'integral(' } as Record<string, string>)[spec.effect];
    const matches = equal(value, spec.target, spec.imaginary ?? 0) && (!requirement || this.rail.source().includes(requirement));
    this.rail.cooldown = this.phase ? 2 : .8;
    this.rail.preview.setText(result.display).setAlpha(1);
    this.rail.status.setText(matches ? 'An idea becomes real.' : requirement && !this.rail.source().includes(requirement) ? `Use ${spec.effect === 'sum' ? 'summation' : spec.effect === 'derivative' ? 'a derivative' : 'an integral'} for this device.` : `Result: ${result.display}. ${spec.label}.`);
    this.effectMagnitude = Math.min(12, Math.hypot(value.re, value.im)); this.effectAngle = Math.atan2(value.im, value.re);
    this.animateSimplification(result.display, matches);
    if (!matches) {
      this.args.audio.play('grab');
      this.previewEffect(value.re, value.im);
      if (!this.phase) this.materialize(false);
      return;
    }
    this.args.audio.play('solve'); this.rail.solved = true;
    if (this.ending) { this.finishCampaign(); return; }
    if (this.phase) {
      if (this.counterLock > 0) { this.rail.status.setText('Let the current counter reach its target.'); return; }
      this.performCounter();
    } else if (!this.solved) {
      this.solved = true; this.materialize(true);
      if (this.beat.rail.effect === 'rotate' || this.beat.rail.effect === 'reverse') this.redirectBolts(this.effectAngle);
      this.portal.setAlpha(1); this.args.emit({ type: 'toast', text: result.display, sub: 'Now use what you made.' });
    }
  }

  private animateSimplification(result: string, success: boolean): void {
    const source = this.rail.source();
    const terms = this.rail.values.filter((s): s is string => s !== null);
    terms.forEach((term, i) => {
      const glyph = new Formula(this, this.rail.x + (i - (terms.length - 1) / 2) * 60, this.rail.y, term, 32).setDepth(40);
      this.tweens.add({ targets: glyph, x: this.rail.x + 40, y: this.rail.y - 80, scale: .5, alpha: 0, duration: 450 + i * 60, ease: 'Cubic.easeIn', onComplete: () => glyph.destroy() });
    });
    const glyph = new Formula(this, this.rail.x + 40, this.rail.y - 60, result, 46, success ? this.character.hex : '#ebece8').setDepth(40).setAlpha(0);
    this.tweens.add({ targets: glyph, alpha: 1, y: this.rail.y - 100, duration: 400, delay: 240, yoyo: true, hold: 300, onComplete: () => glyph.destroy() });
    this.dust.burst(this.rail.x, this.rail.y, success ? this.character.color : INK, 24, 130);
    if (source.includes('sqrt(-1)')) {
      this.args.emit({ type: 'toast', text: '√(−1) = i', sub: 'A whole new direction.' }); this.args.audio.play('unlock');
    }
  }

  private previewEffect(re: number, im: number): void {
    const graphic = this.add.graphics().setDepth(3);
    const length = Phaser.Math.Clamp(Math.hypot(re, im) * 35, 8, 300);
    const targetX = this.phase ? 970 : 1190, targetY = this.phase ? 340 : 515;
    graphic.lineStyle(2, INK, .35).lineBetween(targetX, targetY, targetX + Math.cos(Math.atan2(im, re)) * length, targetY - Math.sin(Math.atan2(im, re)) * length);
    this.tweens.add({ targets: graphic, alpha: 0, duration: 1200, onComplete: () => graphic.destroy() });
    // Valid alternatives still exert force, even when they do not satisfy this device's goal.
    for (const token of this.tokens) if (token.state !== 'held') token.body.setVelocity(token.body.velocity.x + re * 24, token.body.velocity.y - im * 60);
  }

  private materialize(matched: boolean): void {
    for (const p of this.devicePlatforms) p.rect.destroy();
    this.platforms = this.platforms.filter(p => !this.devicePlatforms.includes(p));
    this.devicePlatforms = [];
    this.standing = undefined;
    const start = this.platforms.length;
    this.deviceActive = true;
    const layout = this.beat.layout;
    if (!matched) {
      const expected = Math.hypot(this.beat.rail.target, this.beat.rail.imaginary ?? 0) || 1;
      const ratio = Phaser.Math.Clamp(this.effectMagnitude / expected, .08, 1.7);
      const width = 610 * ratio;
      if (layout === 'gap') this.platform(940 + width / 2, 546, width, 12);
      else if (layout === 'waves' || layout === 'orbit') {
        for (let i = 0; i < 6; i++) this.platform(1000 + i * 100, 510, 80, 12, layout === 'waves' ? 'wave' : 'orbit', this.effectAngle + i * .7, Math.min(110, 45 * ratio));
      } else for (let i = 0; i < Math.min(7, Math.ceil(this.effectMagnitude)); i++) this.platform(1000 + i * 115, 545 - i * 32, 90, 12);
      this.devicePlatforms = this.platforms.slice(start);
      return;
    }
    if (layout === 'gap') {
      if (this.beat.rail.effect === 'split') { for (let i = 0; i < 2; i++) this.platform(1100 + i * 300, 535 - i * 40, 240, 12); }
      else if (this.beat.rail.effect === 'remove') this.platform(1245, 570, 610, 10);
      else this.platform(1245, 546, 610, 12);
    } else if (layout === 'stairs' || layout === 'tower') {
      const count = Phaser.Math.Clamp(Math.ceil(this.effectMagnitude), 3, 8);
      for (let i = 0; i < count; i++) this.platform(1020 + i * 500 / (count - 1), 528 - Math.min(i, 3) * 47, 110, 12, layout === 'tower' && i === count - 1 ? 'lift' : undefined, 0, 60);
      if (layout === 'tower') this.platform(1700, 340, 130, 12);
    } else if (layout === 'orbit') {
      for (let i = 0; i < 6; i++) this.platform(1020 + i * 95, 465, 95, 12, 'orbit', i * Math.PI / 3 + this.effectAngle, 45);
    } else if (layout === 'waves') {
      for (let i = 0; i < 7; i++) this.platform(1000 + i * 85, 500, 85, 12, 'wave', i * .75, 48);
    }
    const created = this.platforms.slice(start);
    this.devicePlatforms = created;
    created.forEach((p, i) => { p.rect.setAlpha(0); this.tweens.add({ targets: p.rect, alpha: 1, duration: 450, delay: i * 80 }); this.dust.burst(p.rect.x, p.rect.y, INK, 10, 80); });
    for (const token of this.tokens) for (const p of created) this.physics.add.collider(token.collider, p.rect);
    if (!this.args.settings.reducedMotion) this.cameras.main.shake(120, .002);
  }

  private redirectBolts(angle: number): void {
    for (const bolt of this.bolts) {
      const vx = bolt.vx, vy = bolt.vy;
      bolt.vx = vx * Math.cos(angle) + vy * Math.sin(angle);
      bolt.vy = -vx * Math.sin(angle) + vy * Math.cos(angle);
      bolt.friendly = true;
    }
  }

  private performCounter(): void {
    const effect = this.beat.rail.effect;
    this.counterLock = 2.7;
    this.redirectBolts(effect === 'reverse' ? Math.PI : effect === 'rotate' ? Math.PI / 2 : this.effectAngle);
    if (effect === 'derivative') { this.bossStun = 4; this.bossLabel?.setText('d/dt(t²) = 2t → 0'); }
    if (effect === 'integral') { this.shield = 8; this.bossLabel?.setText('∫₀⁴ t dt = 8'); }
    const start = new Phaser.Math.Vector2(this.rail.x, this.rail.y - 35), end = new Phaser.Math.Vector2(940, 240);
    let via = new Phaser.Math.Vector2(780, 280);
    if (effect === 'rotate' || effect === 'orbit') via = new Phaser.Math.Vector2(940 + Math.cos(this.effectAngle) * 230, 240 - Math.sin(this.effectAngle) * 220);
    if (effect === 'reverse') via = new Phaser.Math.Vector2(1110, 480);
    const count = effect === 'sum' ? 4 : 1;
    for (let i = 0; i < count; i++) {
      const glyph = new Formula(this, start.x, start.y, effect === 'sum' ? '2' : this.rail.result.display, 34, this.character.hex).setDepth(25);
      this.pulses.push({ start: start.clone(), end: end.clone(), via: via.clone().add(new Phaser.Math.Vector2(i * 30, -i * 25)), age: -i * .14, duration: effect === 'integral' ? 3.5 : 1.1, glyph, trail: [], boss: i === count - 1 });
    }
  }

  private bossHit(): void {
    if (this.transition || this.ending) return;
    this.hitCount++; this.bossStun = Math.max(this.bossStun, 1.4);
    this.dust.burst(940, 240, this.character.color, 65, 250); this.args.audio.play('hit');
    if (!this.args.settings.reducedMotion) this.cameras.main.shake(200, .004);
    this.bossFormula?.setAlpha(.2);
    this.tweens.add({ targets: this.bossFormula, alpha: 1, duration: 400 });
    if (this.hitCount >= this.phase!.hits) {
      this.bolts.forEach(b => b.glyph.destroy()); this.bolts = [];
      this.warnings.forEach(w => w.glyph.destroy()); this.warnings = [];
      this.transition = true;
      this.args.emit({ type: 'toast', text: this.phase!.name, sub: 'Term removed.' });
      const pieces = ['+', '−', '1', '(', ')', 'i'];
      pieces.forEach((piece, i) => {
        const glyph = new Formula(this, 940, 240, piece, 27).setDepth(25);
        this.tweens.add({ targets: glyph, x: 940 + Math.cos(i) * 280, y: 240 + Math.sin(i) * 200, rotation: i, alpha: 0, duration: 1100, onComplete: () => glyph.destroy() });
      });
      this.time.delayedCall(1800, () => {
        if (this.save.encounter === CAMPAIGN.length - 1 && this.save.beat === this.encounter.phases!.length - 1) this.beginIdentity();
        else this.advance();
      });
    } else {
      this.rail.status.setText('Counter landed. Shape the next one.');
      this.args.emit({ type: 'toast', text: `${this.hitCount} / ${this.phase!.hits}`, sub: 'The expression is coming apart.' });
    }
  }

  private beginIdentity(): void {
    this.transition = false; this.ending = true; this.hp = 3; this.attackTimer = Infinity;
    this.bossFormula?.destroy(); this.bossFormula = this.makeBossFormula('e^(iπ)', 94);
    this.bossLabel?.setText('−1');
    this.rail.container.destroy(true);
    this.rail = new Rail(this, 650, 536, { label: 'Finish the expression', slots: ['value'], prefix: 'e^(iπ)+', effect: 'identity', target: 0, example: 'e^(iπ) + 1 = 0', hint: 'It began with one. It ends with one.' }, this.character.color);
    this.args.emit({ type: 'toast', text: 'eⁱπ + □ = 0', sub: 'One last possibility.' });
  }

  private finishCampaign(): void {
    this.transition = true; this.save.complete = true; this.commitSave();
    this.args.audio.play('unlock'); this.bossFormula?.destroy(); this.bossLabel?.destroy();
    const zero = text(this, 860, 240, '0', 120, '#ebece8').setDepth(40);
    this.tweens.add({ targets: zero, scale: .01, alpha: 0, duration: 1800, ease: 'Cubic.easeIn', onComplete: () => zero.destroy() });
    this.dust.burst(860, 240, INK, 130, 350);
    this.time.delayedCall(2300, () => {
      const terms = ['1', '+ iπ', '+ (iπ)²/2!', '+ (iπ)³/3!', '+ ⋯'];
      terms.forEach((term, i) => {
        const glyph = text(this, 330 + i * 155, 270, term, 32, '#ebece8').setAlpha(0);
        this.tweens.add({ targets: glyph, alpha: 1, y: 240, duration: 800, delay: i * 700 });
      });
      const infinity = text(this, 640, 355, '∞', 72, this.character.hex).setAlpha(0);
      this.tweens.add({ targets: infinity, alpha: 1, duration: 1200, delay: 3100 });
    });
    this.time.delayedCall(8500, () => this.args.emit({ type: 'complete', elapsed: this.save.elapsed }));
  }

  private hitEnemy(enemy: Enemy, force: number, damage: number): void {
    enemy.hp -= damage; enemy.stun = .8; enemy.body.setVelocity(force, -230); this.dust.burst(enemy.rect.x, enemy.rect.y, INK, 12, 100);
    if (enemy.hp <= 0) {
      this.spawnToken('1', enemy.rect.x, enemy.rect.y).body.setVelocity(force * .3, -150);
      enemy.glyph.destroy(); enemy.rect.destroy(); this.enemies = this.enemies.filter(e => e !== enemy);
    }
  }
  private damage(fromX: number): void {
    if (this.invulnerable > 0 || this.dying || this.transition || this.ending || this.shield > 0) return;
    this.hp--; this.invulnerable = 1.5; this.vx = this.player.x < fromX ? -270 : 270; this.vy = -250;
    this.dust.burst(this.player.x, this.player.y, this.character.color, 20, 170); this.args.audio.play('damage');
    if (!this.args.settings.reducedMotion) this.cameras.main.shake(130, .003);
    if (this.hp <= 0) this.die();
  }
  private die(): void {
    if (this.dying) return;
    this.dying = true; this.hp = 0; this.vx = 0;
    this.time.delayedCall(650, () => { this.args.emit({ type: 'death' }); this.scene.pause(); });
  }
  restartCheckpoint(): void { this.scene.restart({ ...this.args, save: this.save, chapterCard: false }); }
  resumeFromMenu(): void { this.pauseDebounce = .25; this.input.keyboard?.resetKeys(); this.scene.resume(); }
  private commitSave(): void { this.args.emit({ type: 'save', save: { ...this.save } }); }
  private advance(): void {
    const steps = this.encounter.phases ?? this.encounter.beats;
    const oldChapter = this.encounter.chapter;
    if (this.save.beat + 1 < steps.length) this.save.beat++;
    else { this.save.encounter++; this.save.beat = 0; }
    this.save.furthest = Math.max(this.save.furthest, this.save.encounter);
    this.commitSave();
    this.scene.restart({ ...this.args, save: this.save, chapterCard: CAMPAIGN[this.save.encounter].chapter !== oldChapter });
  }

  private warn(kind: string, x: number, y: number, tx: number, ty: number, delay = .95): void {
    const total = delay * this.character.timing;
    const glyph = text(this, x, y - 24, ({ negative: '−', vectors: '→', waves: 'sin', bolts: '÷' } as Record<string, string>)[kind] ?? '+', 28, '#aab1b5').setDepth(18);
    this.warnings.push({ x, y, tx, ty, timer: total, total, kind, glyph });
  }
  private attackPattern(): void {
    if (!this.phase && !this.beat.hazard) return;
    const kind = this.beat.hazard ?? 'bolts';
    const boss = Boolean(this.phase), x = boss ? 950 : this.cameo?.x ?? Math.min(this.worldWidth - 50, this.player.x + 560), y = boss ? 285 : this.cameo ? this.cameo.y + 20 : 300;
    if (kind === 'negative') {
      this.warn(kind, x, y, this.player.x, this.player.y);
      this.warn(kind, x - 110, y - 70, this.player.x + 85, 600, 1.3);
    } else if (kind === 'vectors') {
      for (let i = 0; i < (boss ? 3 : 2); i++) this.warn(kind, x + i * 45 - 45, y - 80, this.player.x + (i - 1) * 85, 620, 1 + i * .15);
    } else if (kind === 'waves') {
      this.warn(kind, x, 520, this.player.x - 100, 520, 1.2);
      if (boss) this.warn(kind, x, 390, this.player.x, 460, 1.6);
    } else {
      this.warn(kind, x, y, this.player.x, this.player.y, 1.1);
      if (boss && this.encounter.chapter === 5) for (let i = 0; i < 3; i++) this.warn(kind, x, y + i * 65, this.player.x, 420 + i * 65, 1.2 + i * .2);
    }
    if (boss && this.save.encounter === 5 && this.save.beat === 1 && this.hitCount > 0 && this.rail.values[1] === '^') {
      this.rail.values[1] = '/'; this.rail.refresh();
      this.args.emit({ type: 'toast', text: '÷', sub: 'It changed your operator. Take it back.' });
    }
    this.args.audio.tone(100, .35, 'sine', .07, 70);
  }

  private updateProjectiles(dt: number): void {
    for (const warning of [...this.warnings]) {
      warning.timer -= dt;
      if (warning.timer <= 0) {
        const angle = Phaser.Math.Angle.Between(warning.x, warning.y, warning.tx, warning.ty);
        const speed = 245 + this.encounter.chapter * 22;
        const symbol = warning.kind === 'negative' ? '−1' : warning.kind === 'vectors' ? 'i' : warning.kind === 'waves' ? '∿' : '÷';
        const glyph = new Formula(this, warning.x, warning.y, symbol, 30).setDepth(16);
        this.bolts.push({ x: warning.x, y: warning.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, glyph, age: 0, kind: warning.kind, friendly: false, wave: Math.random() * 6 });
        warning.glyph.destroy(); this.warnings.splice(this.warnings.indexOf(warning), 1);
      }
    }
    for (const bolt of [...this.bolts]) {
      bolt.age += dt; bolt.x += bolt.vx * dt; bolt.y += bolt.vy * dt;
      if (bolt.kind === 'waves') bolt.y += Math.cos(bolt.age * 5 + bolt.wave) * 95 * dt;
      bolt.glyph.setPosition(bolt.x, bolt.y);
      if (bolt.friendly) bolt.glyph.setAlpha(.55);
      if (!bolt.friendly && Phaser.Math.Distance.Between(bolt.x, bolt.y, this.player.x, this.player.y) < 31) { this.damage(bolt.x); bolt.age = 10; }
      if (this.shield > 0 && !bolt.friendly && Math.abs(bolt.x - this.player.x) < 90 && Math.abs(bolt.y - this.player.y) < 90) { this.dust.burst(bolt.x, bolt.y, INK, 12, 70); bolt.age = 10; }
      if (bolt.age > 8 || bolt.x < -100 || bolt.x > this.worldWidth + 100 || bolt.y > 900 || bolt.y < -300) { bolt.glyph.destroy(); this.bolts.splice(this.bolts.indexOf(bolt), 1); }
    }
    for (const pulse of [...this.pulses]) {
      pulse.age += dt;
      if (pulse.age < 0) continue;
      const t = Math.min(1, pulse.age / pulse.duration), one = 1 - t;
      const x = one * one * pulse.start.x + 2 * one * t * pulse.via.x + t * t * pulse.end.x;
      const y = one * one * pulse.start.y + 2 * one * t * pulse.via.y + t * t * pulse.end.y;
      pulse.glyph.setPosition(x, y); pulse.trail.push(new Phaser.Math.Vector2(x, y)); if (pulse.trail.length > 28) pulse.trail.shift();
      if (t >= 1) { pulse.glyph.destroy(); this.pulses.splice(this.pulses.indexOf(pulse), 1); if (pulse.boss) this.bossHit(); }
    }
  }

  update(_time: number, delta: number): void {
    if (!this.playerBody) return;
    const dt = Math.min(delta / 1000, .035);
    this.clock += dt; this.save.elapsed += dt;
    this.pauseDebounce = Math.max(0, this.pauseDebounce - dt);
    const combat = Boolean(this.phase || this.beat.enemies || this.beat.hazard) && !this.transition && !this.ending;
    const manipulating = Boolean(this.held) || this.editTimer > 0;
    const slow = combat && manipulating && this.focus > 0;
    const scale = slow ? .35 : 1;
    const worldDt = dt * scale; this.worldClock += worldDt;
    if (slow) this.focus = Math.max(0, this.focus - dt);
    else if (!manipulating) this.focus = Math.min(this.character.focus, this.focus + dt * .8);
    this.focusWasActive = slow;
    for (const key of ['invulnerable', 'attack', 'handling', 'editTimer', 'counterLock'] as const) this[key] = Math.max(0, this[key] - dt);
    this.bossStun = Math.max(0, this.bossStun - worldDt); this.shield = Math.max(0, this.shield - worldDt); this.introSafe -= worldDt;
    this.rail.cooldown = Math.max(0, this.rail.cooldown - worldDt);
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC) && this.pauseDebounce <= 0) { this.commitSave(); this.args.emit({ type: 'pause' }); this.scene.pause(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) { this.restartCheckpoint(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.H)) this.args.emit({ type: 'toast', text: notation(this.beat.rail.example), sub: this.beat.rail.hint });
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.cycleRack(1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interact();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.evaluateRail();
    if (this.meleeQueue) { this.strikeOrThrow(); this.meleeQueue = false; }
    this.updateMovement(dt, scale);
    this.movePlatforms(worldDt);
    this.enemies.forEach(enemy => {
      enemy.time += worldDt; enemy.stun -= worldDt;
      if (enemy.stun <= 0) {
        let direction = Math.sign(this.player.x - enemy.rect.x);
        if (Math.abs(this.player.x - enemy.rect.x) > 430) direction = Math.cos(enemy.time) > 0 ? 1 : -1;
        const ahead = enemy.rect.x + direction * 40;
        const hasFloor = this.platforms.some(p => Math.abs(ahead - p.rect.x) < p.width / 2 && p.rect.y >= enemy.rect.y && p.rect.y < enemy.rect.y + 85);
        enemy.body.setVelocityX(hasFloor ? direction * (enemy.kind === 'operator' ? 95 : 65) : -direction * 50);
        if (enemy.kind === 'cluster' && enemy.body.blocked.down && Math.sin(enemy.time * 2) > .985) enemy.body.setVelocityY(-300);
      }
    });
    this.physics.world.update(this.worldClock * 1000, worldDt * 1000);
    this.vy = this.playerBody.velocity.y * scale;
    this.tokens.forEach(token => {
      token.update(worldDt, this.playerBody.center.x + Math.cos(this.aim()) * 39, this.playerBody.center.y - 10 + Math.sin(this.aim()) * 29);
      if (token.state === 'thrown') {
        if (token.age > .15 && token.age < 2) {
          const slot = this.rail.slotAt(token.body.center.x, token.body.center.y);
          if (slot >= 0 && this.rail.values[slot] === null && compatible(token.source, this.rail.spec.slots[slot])) { this.rail.insert(token.source, slot); this.discardToken(token); return; }
        }
        for (const enemy of [...this.enemies]) if (!token.hit.has(enemy) && Phaser.Math.Distance.Between(token.body.center.x, token.body.center.y, enemy.body.center.x, enemy.body.center.y) < 40) {
          token.hit.add(enemy); this.hitEnemy(enemy, token.body.velocity.x * .65, Math.abs(token.body.velocity.x) > 450 ? 2 : 1); token.body.velocity.x *= .55;
        }
        if (token.body.speed < 45 && token.age > .5) token.state = 'loose';
      }
    });
    for (const token of [...this.tokens]) if (token.state !== 'held' && (token.body.center.y > 820 || token.age > 40 || token.x < -80 || token.x > this.worldWidth + 80)) {
      if (this.save.encounter === 0 && this.save.beat === 0 && !this.solved) { token.release(330, 470); token.body.setGravityY(0); } else this.discardToken(token);
    }
    if (this.tokens.length > 35) { const loose = this.tokens.find(t => t.state === 'loose'); if (loose) this.discardToken(loose); }
    this.enemies.forEach(e => { e.glyph.setPosition(e.body.center.x, e.body.center.y).setRotation(Math.sin(e.time * 2) * .12); });
    for (const enemy of [...this.enemies]) if (enemy.rect.y > 850) this.hitEnemy(enemy, 0, 99);
    if (combat && this.introSafe <= 0 && this.bossStun <= 0) {
      this.attackTimer -= worldDt;
      if (this.attackTimer <= 0) { this.attackPattern(); this.attackTimer = this.phase ? Math.max(2.1, 4.5 - this.encounter.chapter * .34) : 4.8; }
    }
    this.updateProjectiles(worldDt);
    if (this.playerBody.center.y > 830 && !this.dying) this.die();
    if (!this.phase && this.solved && !this.transition && Math.abs(this.playerBody.center.x - this.goalX) < 45 && Math.abs(this.playerBody.bottom - this.portal.y) < 90) {
      this.transition = true; this.args.audio.play('unlock'); this.time.delayedCall(650, () => this.advance());
    }
    this.drawWorld(dt, slow);
    this.dust.update(worldDt); this.args.audio.update(worldDt, this.encounter.chapter, combat);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.updateHud(); this.hudTimer = .1; }
  }

  private updateMovement(dt: number, scale: number): void {
    const grounded = this.playerBody.blocked.down;
    this.coyote = grounded ? .12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.jumpBuffer = .13;
    const direction = (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
    if (!this.dying && !this.transition) {
      if (this.invulnerable < 1.3) this.vx = Phaser.Math.Linear(this.vx, direction * 295 * this.character.speed, Math.min(1, dt * (grounded ? 18 : 10)));
      if (direction) this.facing = direction;
      if (this.jumpBuffer > 0 && this.coyote > 0) { this.vy = -560 * this.character.jump; this.coyote = 0; this.jumpBuffer = 0; this.standing = undefined; this.args.audio.play('jump'); this.dust.burst(this.player.x, this.player.y + 30, this.character.color, 6, 70); }
      if (Phaser.Input.Keyboard.JustUp(this.keys.SPACE) && this.vy < -200) this.vy *= .52;
    } else this.vx *= .85;
    this.vy = Math.min(1000, this.vy + 1450 * dt);
    if (this.deviceActive && ['launch', 'power'].includes(this.beat.rail.effect) && !this.phase && this.player.x > 840 && this.player.x < 940 && grounded) { this.vy = -Math.min(850, 390 + this.effectMagnitude * 48); this.vx = 420 * (Math.cos(this.effectAngle) < 0 ? -1 : 1); this.launched = true; this.args.audio.play('throw'); }
    this.playerBody.setVelocity(this.vx / scale, this.vy / scale);
    if (this.player.x < 18) { this.player.x = 18; this.vx = Math.max(0, this.vx); }
    if (this.player.x > this.worldWidth - 18) { this.player.x = this.worldWidth - 18; this.vx = Math.min(0, this.vx); }
  }

  private movePlatforms(_dt: number): void {
    for (const p of this.platforms) if (p.motion) {
      const oldX = p.rect.x, oldY = p.rect.y;
      const phase = this.worldClock * (p.motion === 'orbit' ? .6 : 1.05) + p.phase;
      p.rect.x = p.baseX + (p.motion === 'orbit' ? Math.cos(phase) * p.amplitude : 0);
      p.rect.y = p.baseY + Math.sin(phase) * p.amplitude;
      p.body.updateFromGameObject();
      if (this.standing === p && this.playerBody.blocked.down && this.vy >= 0 && Math.abs(this.playerBody.bottom - (oldY - p.height / 2)) < 12) {
        this.player.x += p.rect.x - oldX; this.player.y += p.rect.y - oldY;
      }
    }
  }

  private drawWorld(dt: number, slow: boolean): void {
    const g = this.geometry.clear(), overlay = this.overlay.clear(), fg = this.figures.clear();
    this.platforms.forEach(p => {
      g.lineStyle(p.height > 15 ? 1.2 : 1.7, INK, p.rect.alpha * (p.motion ? .85 : .6)).lineBetween(p.rect.x - p.width / 2, p.rect.y - p.height / 2, p.rect.x + p.width / 2, p.rect.y - p.height / 2);
      if (p.motion) { g.lineStyle(1, MUTED, .18).lineBetween(p.baseX, p.baseY + 70, p.rect.x, p.rect.y); g.fillStyle(INK, .8).fillCircle(p.rect.x, p.rect.y - p.height / 2, 2); }
    });
    if (!this.solved && !this.phase) {
      if (this.beat.rail.effect === 'remove') {
        g.fillStyle(INK, .07).fillRect(1010, 355, 410, 273);
        g.lineStyle(1, INK, .4).strokeRect(1010, 355, 410, 273);
      }
      g.lineStyle(1, MUTED, .4);
      for (let x = 985; x < 1540; x += 24) g.lineBetween(x, 564, x + 10, 564);
    }
    if (this.solved && !this.phase && ['launch', 'power'].includes(this.beat.rail.effect)) {
      g.lineStyle(2, this.character.color, .8).lineBetween(890, 609, 890, 555).lineBetween(890, 555, 880, 568).lineBetween(890, 555, 900, 568);
      g.strokeEllipse(890, 614, 64, 12);
    }
    if (this.encounter.chapter >= 3) {
      const cx = this.phase ? 955 : 1240, cy = this.phase ? 242 : 395, radius = this.phase ? 142 : 145;
      g.lineStyle(1, INK, .16).strokeCircle(cx, cy, radius);
      g.lineStyle(1, INK, .08).lineBetween(cx - radius - 40, cy, cx + radius + 40, cy).lineBetween(cx, cy - radius - 40, cx, cy + radius + 40);
      const theta = this.worldClock * .6;
      const px = cx + Math.cos(theta) * radius, py = cy - Math.sin(theta) * radius;
      g.lineStyle(1, INK, .35).lineBetween(cx, cy, px, py); g.fillStyle(INK, .8).fillCircle(px, py, 4);
      g.lineStyle(1, this.character.color, .4).lineBetween(cx, cy, px, cy).lineBetween(px, cy, px, py);
    }
    if (this.beat.layout === 'waves' || this.beat.hazard === 'waves') {
      g.lineStyle(1, INK, .22).beginPath();
      for (let x = 0; x <= this.worldWidth; x += 8) { const y = 380 + Math.sin(x / 125 + this.worldClock) * 70; if (!x) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath();
    }
    this.warnings.forEach(w => {
      const alpha = .18 + .45 * (1 - w.timer / w.total);
      overlay.lineStyle(1, 0xefb7a4, alpha);
      const distance = Phaser.Math.Distance.Between(w.x, w.y, w.tx, w.ty), count = Math.max(1, Math.floor(distance / 18));
      for (let i = 0; i < count; i++) { const a = i / count, b = Math.min(1, a + .5 / count); overlay.lineBetween(Phaser.Math.Linear(w.x, w.tx, a), Phaser.Math.Linear(w.y, w.ty, a), Phaser.Math.Linear(w.x, w.tx, b), Phaser.Math.Linear(w.y, w.ty, b)); }
      overlay.strokeCircle(w.tx, w.ty, 18 + w.timer * 8);
      w.glyph.setAlpha(.4 + Math.sin(this.clock * 12) * .3);
    });
    this.pulses.forEach(p => { if (p.trail.length > 1) { overlay.lineStyle(2, this.character.color, .5).beginPath().moveTo(p.trail[0].x, p.trail[0].y); p.trail.forEach(point => overlay.lineTo(point.x, point.y)); overlay.strokePath(); } });
    const grounded = this.playerBody.blocked.down;
    if (!this.dying || this.clock % .2 < .1) drawFigure(fg, this.playerBody.center.x, this.playerBody.center.y, this.character.color, { time: this.clock, speed: this.vx, grounded, facing: this.facing, held: Boolean(this.held), attack: this.attack, hurt: this.invulnerable > 0 && this.clock % .16 < .08, aim: this.aim() });
    if (grounded && Math.abs(this.vx) > 170 && Math.random() < dt * 12) this.dust.burst(this.player.x, this.player.y + 30, MUTED, 1, 30);
    if (this.attack > 0) { overlay.lineStyle(2, this.character.color, this.attack * 2).beginPath().arc(this.player.x, this.player.y - 8, 55, this.facing > 0 ? -.8 : 2.3, this.facing > 0 ? .8 : 3.9).strokePath(); }
    if (this.shield > 0) {
      overlay.fillStyle(this.character.color, .045).fillRect(this.player.x - 77, this.player.y - 90, 154, 126);
      overlay.lineStyle(2, this.character.color, .7).strokeRect(this.player.x - 77, this.player.y - 90, 154, 126);
      for (let i = 1; i < 8; i++) overlay.lineStyle(1, this.character.color, .18).lineBetween(this.player.x - 77 + i * 19.25, this.player.y - 90, this.player.x - 77 + i * 19.25, this.player.y + 36);
    }
    if (this.phase && this.bossFormula) {
      this.bossFormula.y = 235 + Math.sin(this.worldClock * 1.5) * (this.bossStun > 0 ? 2 : 12);
      if (!this.ending) {
        const radius = 123, angle = this.worldClock * .5;
        for (let i = 0; i < this.phase.hits; i++) {
          const theta = angle + i / this.phase.hits * Math.PI * 2;
          g.lineStyle(2, i < this.hitCount ? this.character.color : INK, i < this.hitCount ? .12 : .5).beginPath().arc(950, 238, radius + i * 10, theta, theta + .9).strokePath();
        }
      }
      if (this.encounter.chapter === 5 && !this.ending) {
        const scale = this.bossStun > 0 ? .75 : 1;
        for (let arm = 0; arm < 6; arm++) {
          const angle = arm * Math.PI / 3 + this.worldClock * .07;
          let lastX = 950, lastY = 238;
          for (let node = 1; node <= 5; node++) {
            const a = angle + Math.sin(this.worldClock * .7 + node * .6) * .22;
            const x = 950 + Math.cos(a) * node * 43 * scale, y = 238 + Math.sin(a) * node * 43 * scale;
            g.lineStyle(1.2, INK, .15 + node * .025).lineBetween(lastX, lastY, x, y);
            g.fillStyle(INK, .3).fillCircle(x, y, node === 5 ? 4 : 2);
            lastX = x; lastY = y;
          }
        }
      }
    }
    if (this.cameo) { this.cameo.x = Math.min(this.worldWidth - 100, this.cameras.main.scrollX + 1060); this.cameo.y = 230 + Math.sin(this.worldClock * .8) * 25; this.cameo.setAlpha(this.solved ? .25 : .65); }
    if (slow) {
      overlay.lineStyle(1, this.character.color, .15).strokeCircle(this.player.x, this.player.y, 76 + Math.sin(this.clock * 2) * 5);
    }
    if (this.held && this.character.id === 'yellow') {
      const angle = this.aim(), force = 660; overlay.fillStyle(this.character.color, .45);
      for (let t = .05; t < .8; t += .065) overlay.fillCircle(this.player.x + Math.cos(angle) * (40 + force * t), this.player.y - 10 + Math.sin(angle) * (30 + force * t) + 350 * t * t, 1.8);
    }
    if (this.character.id === 'yellow' && this.nearRail() && this.rail.result.valid) {
      const value = this.rail.result.value!, a = Math.atan2(value.im, value.re);
      const tx = this.phase ? 940 : 1240, ty = this.phase ? 240 : 465;
      overlay.lineStyle(1, this.character.color, .2).lineBetween(this.rail.x, this.rail.y - 40, tx, ty);
      overlay.lineStyle(2, this.character.color, .4).lineBetween(tx, ty, tx + Math.cos(a) * 100, ty - Math.sin(a) * 100);
      overlay.strokeCircle(tx + Math.cos(a) * 100, ty - Math.sin(a) * 100, 10);
    }
    const nearby = this.nearRail(); this.rail.selected = this.selectedSlot(); this.rail.draw(this.clock, nearby, this.held?.source ?? null, this.character.id === 'yellow');
    const rack = this.nearbyRack();
    if (nearby) this.hint.setText(this.held ? 'E  place / swap     ·     Aim at a slot to choose it     ·     F  evaluate' : 'E  take a term     ·     F  evaluate     ·     H  hint');
    else if (rack) this.hint.setText(`E  take ${notation(rack.source)}     ·     Scroll / Q  choose symbol     ·     ${rack.index + 1} / ${rack.choices.length}`);
    else if (this.held) this.hint.setText('E  drop     ·     Aim + click  throw');
    else if (this.clock < 18 && this.save.encounter === 0) this.hint.setText('A D  move     ·     Space  jump     ·     E  pick up');
    else this.hint.setText('');
  }

  private updateHud(): void {
    this.args.emit({ type: 'hud', hp: this.hp, focus: this.focus, maxFocus: this.character.focus, held: this.held?.source ?? null,
      objective: this.ending ? 'Complete eⁱπ + 1 = 0.' : this.solved ? 'Reach the open doorway.' : this.beat.objective,
      chapter: this.encounter.chapter, title: this.encounter.title, phase: this.phase ? `${this.save.beat + 1} / ${this.encounter.phases!.length}` : `${this.save.beat + 1} / ${this.encounter.beats.length}`,
      progress: (this.save.encounter + this.save.beat / (this.encounter.phases ?? this.encounter.beats).length) / CAMPAIGN.length });
  }
}
