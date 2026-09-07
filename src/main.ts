import Phaser from 'phaser';
import '@fontsource/stix-two-math';
import '@fontsource-variable/manrope';
import './style.css';
import { Backdrop } from './game/Backdrop';
import { Gameplay } from './game/Gameplay';
import { AudioEngine } from './game/audio';
import { CAMPAIGN, CHAPTERS, unlockedThrough } from './content/campaign';
import { CHARACTERS, type CharacterId, type CheckpointState, type GameEvent, type Settings } from './game/types';
import { notation } from './math/evaluate';

const root = document.querySelector<HTMLDivElement>('#interface')!;
const SAVE_KEY = 'you-vs-math.save.v1', SETTINGS_KEY = 'you-vs-math.settings.v1';
function read<T>(key: string): T | null { try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null; } catch { return null; } }
let saved = read<CheckpointState>(SAVE_KEY);
if (saved && (saved.version !== 1 || saved.encounter >= CAMPAIGN.length || !CHARACTERS.some(c => c.id === saved!.character))) saved = null;
if (saved && saved.encounter < 3 && saved.beat >= CAMPAIGN[saved.encounter].beats.length) {
  saved.encounter++;
  saved.beat = 0;
  saved.furthest = Math.max(saved.furthest, saved.encounter);
  saved.unlocked = unlockedThrough(saved.encounter);
}
let settings: Settings = { sound: true, reducedMotion: false, volume: .55, ...read<Settings>(SETTINGS_KEY) };
const audio = new AudioEngine(settings);
let selected: CharacterId = saved?.character ?? 'orange';
let screen = 'title';
let toastTimer: ReturnType<typeof setTimeout>;
let chapterTimer: ReturnType<typeof setTimeout>;
let currentHud: Extract<GameEvent, { type: 'hud' }> | undefined;
function persist(key: string, value: unknown): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage; the current run remains playable. */ } }

await Promise.all([document.fonts.load('16px "STIX Two Math"'), document.fonts.load('400 16px "Manrope Variable"')]);
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 1280, height: 720, backgroundColor: '#090b0d',
  antialias: true, roundPixels: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false, fixedStep: false, customUpdate: true } },
  scene: [Backdrop, Gameplay],
  render: { transparent: false, powerPreference: 'high-performance' },
});

function figure(color: string, variant = 0): string {
  const arm = variant === 4 ? 'M51 49 70 58 84 49' : variant === 2 ? 'M51 49 64 38 75 33' : 'M51 49 67 57 77 47';
  return `<svg viewBox="0 0 110 150" fill="none" aria-hidden="true"><g stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="55" cy="26" r="12"/><path d="M54 39 47 85 29 126M47 85 71 125M52 50 33 65 28 83${arm}"/></g></svg>`;
}
function brand(): string { return '<a class="brand" href="#" data-action="title" aria-label="You vs Math home"><span class="brand-mark">y<span>m</span></span><span>YOU VS MATH</span></a>'; }
function soundButton(): string { return `<button class="text-button sound-toggle" data-action="sound" aria-label="${settings.sound ? 'Mute' : 'Enable'} sound"><span class="sound-icon">${settings.sound ? '◖))' : '◖×'}</span> SOUND ${settings.sound ? 'ON' : 'OFF'}</button>`; }
function title(): void {
  screen = 'title'; clearTimeout(chapterTimer); clearTimeout(toastTimer);
  game.scene.stop('Gameplay'); game.scene.wake('Backdrop');
  root.innerHTML = `<div class="title-screen">
    <header>${brand()}<nav><button class="text-button" data-action="controls">HOW TO PLAY <span>↗</span></button>${soundButton()}<button class="icon-button" data-action="fullscreen" aria-label="Toggle fullscreen">⛶</button></nav></header>
    <main class="title-main"><div class="eyebrow"><span class="live-dot"></span> A PLAYABLE EXPERIMENT IN POSSIBILITY</div>
      <h1><span class="you">You</span><span class="versus">vs</span><span class="math">Math<span class="period">.</span></span></h1>
      <p class="lead">The world is an equation.<br>Be the unexpected variable.</p>
      <div class="title-actions"><button class="primary" data-action="${saved && !saved.complete ? 'continue' : 'choose'}">${saved && !saved.complete ? 'Continue your journey' : 'Enter the equation'}<span>↗</span></button>${saved && !saved.complete ? '<button class="secondary" data-action="choose">New journey</button>' : ''}</div>
      <div class="game-meta"><span>SINGLE PLAYER</span><i></i><span>FIVE CHAPTERS</span><i></i><span>KEYBOARD + MOUSE</span></div>
    </main>
    <div class="art-caption"><span>01 — YOU</span><span>∞ — THE UNKNOWN</span></div>
    <footer class="chapter-strip">${CHAPTERS.map((chapter, i) => `<button class="chapter-link ${i === 0 ? 'available' : ''}" data-action="chapters"><span class="chapter-number">0${i + 1}</span><span>${chapter.title}</span><span class="chapter-symbol">${['+', '−', 'i', 'π', '∞'][i]}</span></button>`).join('')}</footer>
    <div class="bottom-note"><span>THINK. MOVE. TRANSFORM.</span><span>Inspired by Animation vs. Math <span class="muted">/</span> An independent fan game</span></div>
  </div>`;
}
function choose(): void {
  screen = 'choose';
  root.innerHTML = `<div class="selection-screen"><header>${brand()}<button class="text-button" data-action="title">← BACK</button></header>
    <main class="selection-main"><div class="eyebrow">EVERY VARIABLE HAS POTENTIAL</div><h2>Who will you <em>be?</em></h2><p>Five ways to move through the same impossible world.</p>
      <div class="characters">${CHARACTERS.map((c, i) => `<button class="character ${c.id === selected ? 'selected' : ''}" data-character="${c.id}" style="--character:${c.hex}" aria-pressed="${c.id === selected}"><span class="character-index">0${i + 1}</span><div class="character-art">${figure(c.hex, i)}</div><span class="character-name">${c.name}</span><span class="character-trait">${c.trait}</span><span class="character-description">${c.description}</span><span class="selection-indicator">${c.id === selected ? 'SELECTED' : 'CHOOSE'}</span></button>`).join('')}</div>
      <div class="selection-bottom"><span>Same journey. Your own approach.</span><button class="primary" data-action="start">Let’s begin<span>→</span></button></div>
    </main></div>`;
}
function newSave(encounter = 0): CheckpointState { return { version: 1, character: selected, encounter, beat: 0, furthest: saved?.furthest ?? 0, unlocked: unlockedThrough(encounter), complete: false, elapsed: 0 }; }
function launch(save: CheckpointState): void {
  audio.start(); saved = { ...save }; persist(SAVE_KEY, saved); showHud();
  game.scene.sleep('Backdrop'); game.scene.start('Gameplay', { save: saved, settings, audio, emit: onEvent, chapterCard: true });
}
function showHud(): void {
  screen = 'playing';
  root.innerHTML = `<div class="hud"><div class="hud-top"><div class="hud-location"><span id="hud-chapter">CHAPTER I</span><span id="hud-title"></span></div><div class="hud-right"><span id="hud-phase"></span><button class="pause-button" data-action="pause" aria-label="Pause game">Ⅱ</button></div></div><div class="hud-bottom"><div class="vitals"><div id="hearts" class="hearts"></div><div class="focus-track" title="Equation focus"><div id="focus-fill"></div></div><span class="focus-label">FOCUS</span></div><div id="held" class="held"></div><div class="hud-shortcuts"><span>R <small>restart</small></span><span>H <small>hint</small></span></div></div><div class="objective"><span class="objective-dot"></span><span id="objective-text"></span></div><div class="progress-track"><div id="campaign-progress"></div></div></div><div id="toast" class="toast" role="status"></div><div id="chapter-card" class="chapter-card"></div><div id="modal-host"></div>`;
  if (currentHud) renderHud(currentHud);
}
function renderHud(event: Extract<GameEvent, { type: 'hud' }>): void {
  currentHud = event;
  if (screen !== 'playing' && screen !== 'paused' && screen !== 'dead') return;
  const set = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('hud-chapter', `CHAPTER ${CHAPTERS[event.chapter - 1].numeral}`); set('hud-title', event.title); set('hud-phase', event.phase);
  set('objective-text', event.objective); set('held', event.held ? `Holding  ${notation(event.held)}` : '');
  const hearts = document.getElementById('hearts');
  if (hearts && hearts.dataset.hp !== String(event.hp)) { hearts.dataset.hp = String(event.hp); hearts.innerHTML = [0, 1, 2].map(i => `<span class="heart ${i >= event.hp ? 'empty' : ''}"></span>`).join(''); hearts.setAttribute('aria-label', `${event.hp} of 3 health`); }
  const fill = document.getElementById('focus-fill'); if (fill) { fill.style.width = `${event.focus / event.maxFocus * 100}%`; fill.style.background = CHARACTERS.find(c => c.id === saved?.character)?.hex ?? '#ff962f'; }
  const progress = document.getElementById('campaign-progress'); if (progress) progress.style.width = `${event.progress * 100}%`;
}
function onEvent(event: GameEvent): void {
  if (event.type === 'save') { saved = { ...event.save }; persist(SAVE_KEY, saved); }
  else if (event.type === 'hud') renderHud(event);
  else if (event.type === 'toast') {
    const element = document.getElementById('toast'); if (!element) return;
    clearTimeout(toastTimer); element.replaceChildren();
    const title = document.createElement('strong'), sub = document.createElement('span'); title.textContent = event.text; sub.textContent = event.sub ?? ''; element.append(title, sub); element.classList.add('visible');
    toastTimer = setTimeout(() => element.classList.remove('visible'), 4200);
  } else if (event.type === 'chapter') {
    const card = document.getElementById('chapter-card'); if (!card) return;
    card.innerHTML = `<span>CHAPTER ${CHAPTERS[event.chapter - 1].numeral}</span><strong>${event.title}</strong><p>${event.subtitle}</p>`; card.classList.add('visible');
    clearTimeout(chapterTimer); chapterTimer = setTimeout(() => card.classList.remove('visible'), 3300);
  } else if (event.type === 'pause') pause();
  else if (event.type === 'death') death();
  else if (event.type === 'complete') ending(event.elapsed);
}
function pause(): void {
  screen = 'paused'; game.scene.pause('Gameplay');
  document.getElementById('modal-host')!.innerHTML = `<div class="modal-scrim"><section class="pause-panel"><div class="eyebrow">TAKE A MOMENT</div><h2>Between<br><em>possibilities.</em></h2><p>Your place in the equation is saved.</p><button class="primary" data-action="resume">Keep going<span>→</span></button><button class="menu-row" data-action="restart">Restart this checkpoint <span>↺</span></button><button class="menu-row" data-action="controls">Controls <span>↗</span></button><button class="menu-row" data-action="motion">Camera motion <span>${settings.reducedMotion ? 'REDUCED' : 'FULL'}</span></button><button class="menu-row" data-action="sound">Sound <span>${settings.sound ? 'ON' : 'OFF'}</span></button><button class="menu-row" data-action="title">Return to title <span>↗</span></button></section></div>`;
}
function resume(): void { screen = 'playing'; document.getElementById('modal-host')!.innerHTML = ''; (game.scene.getScene('Gameplay') as Gameplay).resumeFromMenu(); }
function death(): void {
  screen = 'dead';
  document.getElementById('modal-host')!.innerHTML = `<div class="modal-scrim"><section class="pause-panel death-panel"><span class="death-glyph">≠</span><div class="eyebrow">A DIFFERENT APPROACH</div><h2>Try another<br><em>possibility.</em></h2><p>Current checkpoint. Full health. Every idea intact.</p><button class="primary" data-action="restart">Try again<span>↺</span></button><button class="menu-row" data-action="title">Return to title<span>↗</span></button><small>PRESS R TO RESTART</small></section></div>`;
}
function controls(): void {
  const returnScreen = screen;
  const markup = `<div class="modal-scrim controls-scrim"><section class="controls-panel"><div class="eyebrow">A FEW SIMPLE RULES</div><h2>Think with<br><em>your hands.</em></h2><div class="control-grid">${[
    ['A D / ← →', 'Run'], ['SPACE', 'Jump · release early for a shorter jump'], ['E', 'Grab, drop, or place a symbol'], ['MOUSE + CLICK', 'Aim and throw · strike when empty-handed'], ['SCROLL / Q', 'Choose a symbol while beside a rack'], ['F', 'Evaluate the nearby equation'], ['H', 'Reveal a mathematical hint'], ['R / ESC', 'Restart checkpoint / pause'],
  ].map(([key, label]) => `<kbd>${key}</kbd><span>${label}</span>`).join('')}</div><p class="control-note">Aim at a rail slot to choose it. Nearby compatible slots snap symbols into place. The equals sign lights when the expression is valid. Hold a symbol to slow combat while focus lasts.</p><button class="primary" data-action="close-controls">Got it<span>→</span></button></section></div>`;
  root.insertAdjacentHTML('beforeend', markup);
  const close = () => { root.querySelector('.controls-scrim')?.remove(); screen = returnScreen; };
  root.querySelector('[data-action="close-controls"]')!.addEventListener('click', close, { once: true });
}
function chapters(): void {
  screen = 'chapters';
  root.innerHTML = `<div class="selection-screen"><header>${brand()}<button class="text-button" data-action="title">← BACK</button></header><main class="chapter-menu"><div class="eyebrow">FROM ONE TO INFINITY</div><h2>A world<br><em>of possibilities.</em></h2><div class="chapter-list">${CHAPTERS.map((chapter, i) => {
    const index = CAMPAIGN.findIndex(e => e.chapter === i + 1), unlocked = index <= (saved?.furthest ?? 0);
    return `<button class="chapter-entry" data-replay="${index}" ${unlocked ? '' : 'disabled'}><span class="chapter-number">${chapter.numeral}</span><span><strong>${chapter.title}</strong><small>${chapter.subtitle}</small></span><span class="chapter-entry-symbol">${unlocked ? '↗' : '·'}</span></button>`;
  }).join('')}</div><p class="muted">Chapters unlock as you move forward. Replay starts at the beginning of a chapter.</p></main></div>`;
}
function ending(elapsed: number): void {
  screen = 'ending'; game.scene.pause('Gameplay');
  root.innerHTML = `<div class="ending-screen"><div class="eyebrow">EVERY END IS A BEGINNING</div><div class="ending-formula">e<sup>iπ</sup> + 1 = 0</div><h2>You changed<br><em>the equation.</em></h2><p>From a single one to an infinite possibility.</p><div class="ending-stats"><span>5 CHAPTERS</span><span>${Math.floor(elapsed / 60)} MINUTES</span><span>ONE UNEXPECTED VARIABLE</span></div><button class="primary" data-action="chapters">Find another possibility<span>↗</span></button><button class="text-button" data-action="title">RETURN TO TITLE</button><div class="credits">Inspired by Alan Becker’s <em>Animation vs. Math</em><br>An independent fan game · Original procedural art and sound<br>Mathematics belongs to everyone.</div></div>`;
}

root.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-character], [data-replay]'); if (!target) return;
  event.preventDefault();
  if (target.dataset.character) { selected = target.dataset.character as CharacterId; choose(); return; }
  if (target.dataset.replay !== undefined && !(target as HTMLButtonElement).disabled) { launch(newSave(Number(target.dataset.replay))); return; }
  const action = target.dataset.action;
  if (action === 'title') title();
  else if (action === 'choose') choose();
  else if (action === 'start') launch(newSave());
  else if (action === 'continue' && saved) launch(saved);
  else if (action === 'chapters') chapters();
  else if (action === 'pause') pause();
  else if (action === 'resume') resume();
  else if (action === 'restart') { showHud(); game.scene.resume('Gameplay'); (game.scene.getScene('Gameplay') as Gameplay).restartCheckpoint(); }
  else if (action === 'controls') controls();
  else if (action === 'fullscreen') { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); }
  else if (action === 'sound' || action === 'motion') {
    if (action === 'sound') settings.sound = !settings.sound; else settings.reducedMotion = !settings.reducedMotion;
    persist(SETTINGS_KEY, settings); audio.configure(settings);
    if (settings.sound) audio.start();
    if (screen === 'paused') pause(); else if (screen === 'title') title();
  }
});
window.addEventListener('keydown', event => {
  if (event.code === 'KeyR' && screen === 'dead') { showHud(); game.scene.resume('Gameplay'); (game.scene.getScene('Gameplay') as Gameplay).restartCheckpoint(); }
  if (event.code === 'Escape' && screen === 'paused') resume();
});
window.addEventListener('blur', () => { if (screen === 'playing') pause(); });
void document.fonts.ready.then(() => title());
