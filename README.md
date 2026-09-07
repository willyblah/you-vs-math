# You vs Math

A single-player browser action-puzzle game inspired by Alan Becker’s *Animation vs. Math*. Carry numbers, swap operators, and evaluate equations to change the arena. Built with TypeScript, Phaser 3, Arcade Physics, and Vite; menus and overlays use HTML/CSS.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the localhost address printed by Vite. The game uses keyboard and mouse and is intended for desktop browsers.

```sh
npm run build       # TypeScript check and static production build in dist/
npm run preview     # Serve the production build locally
npm run check       # TypeScript only
npm test            # Focused math and authored-rail checks; no browser automation
```

The build bundles its fonts and requires no remote services. The source reference video and images remain in `references/` and are not included in the build. Nothing is published online.

## Controls

| Input | Action |
| --- | --- |
| A/D or Left/Right | Run |
| Space | Jump; release early for a shorter jump |
| E | Grab, drop, insert, or retrieve a symbol |
| Mouse + left click | Aim and throw; melee when empty-handed |
| Scroll or Q | Cycle the nearby physical rack’s available symbols |
| F | Evaluate a nearby rail |
| H | Show the current mathematical hint |
| R | Restore the current checkpoint |
| Escape | Pause |

Aim at a slot to choose it. Without an explicit mouse target, a held symbol selects the first compatible empty slot. You must be near a rack or rail to manipulate it. Symbols thrown through empty compatible receivers also snap into place.

The equals sign lights when an expression is mathematically valid. The rail label states the device’s target. Other supported results can still exert force or create different geometry. Boss counters must satisfy the current component and its operation, where applicable.

Holding symbols or editing equations slows combat until focus runs out. Focus recovers while your hands are empty and you are no longer editing. Orange has longer focus; Green has longer attack warnings and quantized throw aiming; Yellow sees result and trajectory previews; Blue moves and handles symbols faster; Red hits and throws harder.

## Campaign

The campaign contains 13 encounters: six puzzles, four action/traversal challenges, and three battles against the recurring Euler expression. Each puzzle contains multiple authored beats. Boss phases have individual checkpoints; retries restore health and arena state.

1. **One Becomes Many:** discovery, addition, repeated addition, multiplication, stacks, and launchers.
2. **Below Zero:** subtraction, zero, negatives, division, powers, roots, and the first duel. Its final counter introduces `i`.
3. **The Complex Plane:** quarter-turns, components, angular control, and rival interference.
4. **The Unit Circle:** radians, periodic platforms, sine/cosine, and the second duel.
5. **Infinite Showdown:** six counter phases covering reversal, rotation, angular control, summation, differentiation, and integration, followed by the final Euler identity and series reconstruction.

Progress and settings are stored locally in the browser. Continue returns to the saved beat or boss phase. Chapter replay becomes available as chapters are reached. Starting a new journey replaces the current checkpoint while keeping chapter access.

The authored pacing target is approximately an hour. End-to-end duration, difficulty balance, and all-character traversal remain for manual playtesting; the timing estimates are not measured playthrough results.

## Extending the game

- `src/content/campaign.ts` defines chapter order, encounters, beats, rail templates, unlocks, objectives, and boss phases. Add a beat to an encounter for another checkpointed puzzle or traversal section.
- `src/math/evaluate.ts` parses supported expressions into an AST and returns a real or complex result with validation diagnostics. It has no Phaser dependencies. Add math behavior here before connecting it to a device.
- `src/game/objects.ts` implements physical tokens, typed rail slots, and symbol racks. `Gameplay.ts` runs movement, simulation, encounter geometry, device effects, hazards, and boss state transitions. `art.ts` handles vector animation and mathematical typography.
- `src/main.ts` owns HTML overlays, character selection, local saves, and scene transitions. `style.css` styles the interface. `audio.ts` synthesizes effects and an ambient score using Web Audio.

For a new rail, specify its slots, optional initial tokens and enclosing expression, physical effect, target value, and hint. Real/imaginary target values are compared numerically; arithmetic equivalents are accepted. Summation, derivative, and integral counters also require the corresponding operation in the expression. New physical effects belong in the device/counter handlers, not in the math evaluator.

Math is deliberately bounded: integer powers, real-angle trigonometry, finite sums of at most 25 terms, and authored polynomial/trigonometric calculus interactions. This is not a general symbolic algebra system. Fractions preserve exact rational values through basic arithmetic; rotations use complex numbers and geometric tolerances.

Arcade Physics handles the player, loose objects, and enemies. The world runs on a shared scaled clock while the player’s controller uses real time. Moving platforms use kinematic positions and carry riders explicitly.

## Credits

Original animation reference: Alan Becker’s *Animation vs. Math*. This is an independent fan game, not an official Alan Becker release. All game art and sound are generated procedurally; the reference video’s soundtrack is not used.

Typography: STIX Two Math and Manrope, distributed under the SIL Open Font License. Phaser is distributed under the MIT License. See `public/third-party-notices.txt` for the bundled notices.
