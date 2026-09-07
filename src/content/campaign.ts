import type { Beat, BossPhase, Encounter, EffectKind, RailSpec } from '../game/types';

export const CHAPTERS = [
  { title: 'One Becomes Many', subtitle: 'Every possibility starts with one.', numeral: 'I' },
  { title: 'Below Zero', subtitle: 'There is something on the other side.', numeral: 'II' },
  { title: 'The Complex Plane', subtitle: 'A new direction changes everything.', numeral: 'III' },
  { title: 'The Unit Circle', subtitle: 'What goes around becomes a way forward.', numeral: 'IV' },
  { title: 'Infinite Showdown', subtitle: 'Even the impossible has an answer.', numeral: 'V' },
];
const arithmetic = (label: string, effect: EffectKind, target: number, op: string, example: string, hint: string): RailSpec =>
  ({ label, effect, target, slots: ['value', 'operator', 'value'], initial: [null, op, null], example, hint });
const single = (label: string, effect: EffectKind, target: number, example: string, hint: string, prefix = '', suffix = '', imaginary = 0): RailSpec =>
  ({ label, effect, target, slots: ['value'], example, hint, prefix, suffix, imaginary });
const angle = (label: string, target: number, imaginary: number, example: string, hint: string): RailSpec =>
  ({ label, effect: 'orbit', target, imaginary, slots: ['angle'], prefix: 'e^(i*(', suffix: '))', example, hint });
const beat = (name: string, objective: string, rail: RailSpec, layout: Beat['layout'], rest: Partial<Beat> = {}): Beat =>
  ({ name, objective, rail, layout, ...rest });
const phase = (name: string, component: string, rail: RailSpec, attack: string, counter: string, hazard: Beat['hazard'], hits = 2): BossPhase =>
  ({ name, component, objective: counter, rail, attack, counter, hazard, layout: 'arena', hits });

export const CAMPAIGN: Encounter[] = [
  {
    id: 'discovery', chapter: 1, title: 'A small beginning', subtitle: 'You. And one possibility.', kind: 'puzzle', duration: 3, unlock: ['1', '+'],
    beats: [
      beat('Hello, one.', 'Pick up the 1. Give it a place in the equation.', single('Make a beginning', 'extend', 1, '1', 'Carry the floating 1 into the empty slot.'), 'gap', { intro: 'E to pick up. E to place. F to make it real.' }),
      beat('One becomes two', 'Extend the bridge to 2 units.', arithmetic('Bridge length · 2', 'extend', 2, '+', '1 + 1', 'The rack always has another 1.'), 'gap', { unlock: ['2'] }),
    ],
  },
  {
    id: 'many', chapter: 1, title: 'More than the sum', subtitle: 'There is a shorter way to say it.', kind: 'puzzle', duration: 2, unlock: ['3', '4', '*'],
    beats: [
      beat('Again. And again.', 'Stack three ones to reach the ledge.', { label: 'Stack height · 3', slots: ['value', 'operator', 'value', 'operator', 'value'], initial: [null, '+', null, '+', null], effect: 'stack', target: 3, example: '1 + 1 + 1', hint: 'Each one becomes another step.' }, 'stairs'),
      beat('A shorter thought', 'Make a six-unit counterweight.', arithmetic('Counterweight · 6', 'stack', 6, '*', '2 × 3', 'Multiplication makes groups of the same size.'), 'tower'),
    ],
  },
  {
    id: 'momentum', chapter: 1, title: 'Applied mathematics', subtitle: 'Put some force behind the idea.', kind: 'action', duration: 2, unlock: [],
    beats: [
      beat('Lift off', 'Charge the launcher to 6, then step into its arrow.', arithmetic('Launch impulse · 6', 'launch', 6, '*', '2 × 3', 'A stronger result means a stronger launch.'), 'tower', { enemies: 2 }),
    ],
  },
  {
    id: 'absence', chapter: 2, title: 'The shape of absence', subtitle: 'Taking away can open a path.', kind: 'puzzle', duration: 4, unlock: ['0', '-', '-1', '/'],
    beats: [
      beat('Nothing in the way', 'Reduce the wall to zero.', arithmetic('Remaining barrier · 0', 'remove', 0, '-', '2 − 2', 'Equal terms cancel.'), 'gap'),
      beat('The other direction', 'Reverse the conveyor with a value of −1.', arithmetic('Direction · −1', 'reverse', -1, '-', '1 − 2', 'Below zero, direction changes.'), 'stairs'),
      beat('Equal shares', 'Split a unit into two equal platforms.', arithmetic('Each share · 1/2', 'split', .5, '/', '1 ÷ 2', 'A fraction is still a physical value.'), 'gap'),
    ],
  },
  {
    id: 'corruption', chapter: 2, title: 'Something is watching', subtitle: 'A familiar shape. An unfamiliar intention.', kind: 'action', duration: 3, unlock: ['^'],
    beats: [
      beat('An unwelcome subtraction', 'Restore eight units of force to the launcher.', arithmetic('Launch impulse · 8', 'power', 8, '^', '2³', 'A power multiplies a value by itself.'), 'tower', { enemies: 2, hazard: 'negative', intro: 'e^(iπ)' }),
      beat('Bring it down to size', 'Reduce nine to three with a root.', single('Reduced scale · 3', 'stack', 3, '√(9)', 'A square root undoes a square.', 'sqrt(', ')'), 'stairs', { unlock: ['9'], enemies: 2, hazard: 'negative' }),
    ],
  },
  {
    id: 'first-duel', chapter: 2, title: 'The other side of one', subtitle: 'e^(iπ) has an answer of its own.', kind: 'boss', duration: 5, unlock: [], beats: [],
    phases: [
      phase('Subtractive armor', 'e^(iπ) − (3 − 2)', arithmetic('Counter direction · −1', 'reverse', -1, '-', '1 − 2', 'A negative pulse sends the fragments back.'), 'SUBTRACT', 'Reverse its fragments with −1.', 'negative'),
      phase('Power against power', 'e^(iπ) · 2³', arithmetic('Break force · 8', 'power', 8, '^', '2³', 'Build an attack with a value of eight.'), 'INVERT / DIVIDE', 'Break the powered term with an eight-unit attack.', 'bolts', 3),
      { ...phase('An impossible root', 'e^(iπ) = −1', single('A new direction', 'rotate', 0, '√(−1)', 'The square root of −1 opens a new direction.', 'sqrt(', ')', 1), '−1', 'Make √(−1). Turn its attack through a right angle.', 'vectors', 1), intro: 'What if the answer is somewhere else?' },
    ],
  },
  {
    id: 'imaginary', chapter: 3, title: 'A turn for the better', subtitle: 'The world has another axis.', kind: 'puzzle', duration: 4, unlock: ['i'],
    beats: [
      beat('The imaginary bridge', 'Rotate the bridge 90° with i.', { ...arithmetic('Quarter turn · i', 'rotate', 0, '*', '1 × i', 'Multiplication by i turns a vector counterclockwise.'), imaginary: 1 }, 'orbit'),
      beat('Two turns', 'Turn twice to point left.', { ...arithmetic('Half turn · −1', 'rotate', -1, '*', 'i × i', 'Two right angles make a reversal.'), imaginary: 0 }, 'orbit'),
      beat('Components', 'Reach the point 2 + i.', { ...arithmetic('Destination · 2 + i', 'rotate', 2, '+', '2 + i', 'Real values move horizontally. Imaginary values move vertically.'), imaginary: 1 }, 'stairs'),
    ],
  },
  {
    id: 'coordinates', chapter: 3, title: 'Around the obstruction', subtitle: 'A straight line is only one possibility.', kind: 'puzzle', duration: 3, unlock: ['π', 'π/2', '3*π/2', '2*π'],
    beats: [
      beat('Choose your angle', 'Move the orbiting point to the top of the circle.', angle('Orbit · π/2', 0, 1, 'e^(iπ/2)', 'Place π/2 in the angle socket.'), 'orbit'),
      beat('Two ways to turn', 'Build the vertical component of Euler’s identity.', { label: 'cos(θ) + i sin(θ) · θ = π/2', slots: ['angle'], prefix: 'cos(', suffix: ')+i*sin(π/2)', effect: 'orbit', target: 0, imaginary: 1, example: 'cos(π/2) + i sin(π/2)', hint: 'At π/2, the horizontal component is zero and the vertical component is one.' }, 'orbit', { intro: 'e^(iθ) = cos(θ) + i sin(θ)' }),
    ],
  },
  {
    id: 'interference', chapter: 3, title: 'An unexpected visitor', subtitle: 'It remembers you.', kind: 'action', duration: 3, unlock: [],
    beats: [
      beat('Off axis', 'Redirect the vector field upward.', { ...arithmetic('Redirect · i', 'rotate', 0, '*', '1 × i', 'A right-angle turn sends incoming vectors away.'), imaginary: 1 }, 'stairs', { enemies: 3, hazard: 'vectors', intro: 'e^(iπ)' }),
      beat('The long way around', 'Orbit below the corrupted obstruction.', angle('Orbit · 3π/2', 0, -1, 'e^(i3π/2)', 'Three quarter turns place the point below the origin.'), 'orbit', { enemies: 2, hazard: 'vectors' }),
    ],
  },
  {
    id: 'circle', chapter: 4, title: 'Everything comes around', subtitle: 'Find your place on the circle.', kind: 'puzzle', duration: 4, unlock: ['sin(π/2)', 'cos(π)', 'cos(2*π)', 'sin(π)'],
    beats: [
      beat('Half a revolution', 'Position the orbit at π.', angle('Orbit · π', -1, 0, 'e^(iπ)', 'π radians is half a turn.'), 'orbit'),
      beat('All the way home', 'Complete one full revolution.', angle('Orbit · 2π', 1, 0, 'e^(i2π)', 'A full revolution returns to one.'), 'orbit'),
      beat('The height of a wave', 'Set the wave amplitude to one.', single('Sine amplitude · 1', 'wave', 1, 'sin(π/2)', 'The top of the unit circle has height one.'), 'waves'),
    ],
  },
  {
    id: 'periodic', chapter: 4, title: 'Riding the function', subtitle: 'Motion has a rhythm.', kind: 'action', duration: 3, unlock: [],
    beats: [
      beat('In phase', 'Align the wave platforms with a cosine of one.', single('Cosine component · 1', 'wave', 1, 'cos(2π)', 'Cosine is the horizontal component of the circle.'), 'waves', { enemies: 2, hazard: 'waves' }),
      beat('Against the current', 'Reverse the periodic field with a cosine of −1.', single('Reverse wave · −1', 'wave', -1, 'cos(π)', 'The opposite side of the circle points left.'), 'waves', { enemies: 3, hazard: 'waves' }),
    ],
  },
  {
    id: 'second-duel', chapter: 4, title: 'A rival in revolution', subtitle: 'The same expression. A larger world.', kind: 'boss', duration: 5, unlock: [], beats: [],
    phases: [
      phase('Rotating armor', 'e^(iθ) [cos θ]', angle('Shield opening · π/2', 0, 1, 'e^(iπ/2)', 'Aim through the opening at the top of the circle.'), 'ROTATE', 'Use π/2 to reach the shield opening.', 'vectors', 3),
      phase('Wave distortion', 'e^(iθ) + i sin(θ)', single('Cancel the wave · −1', 'wave', -1, 'cos(π)', 'A negative component reverses its wave.'), 'OSCILLATE', 'Turn the wave against its source.', 'waves', 3),
      phase('The exposed orbit', 'e^(iθ)', angle('Exposed orbit · 3π/2', 0, -1, 'e^(i3π/2)', 'Reach the core from below.'), 'REVOLVE', 'Attack the core from below its orbit.', 'vectors', 2),
    ],
  },
  {
    id: 'infinite', chapter: 5, title: 'Infinite showdown', subtitle: 'One last expression.', kind: 'boss', duration: 16, unlock: [], beats: [],
    phases: [
      phase('The negative horizon', 'e^(iπ) − [−1] + Σ + d/dt + ∫', arithmetic('Return the barrage · −1', 'reverse', -1, '-', '1 − 2', 'Send the negative horizon back toward its source.'), 'REVERSE', 'Reverse the barrage and remove the negative shell.', 'negative', 3),
      phase('The perpendicular', 'e^(iπ) · [i] + Σ + d/dt + ∫', { ...arithmetic('Perpendicular counter · i', 'rotate', 0, '*', '1 × i', 'Turn the attack through a right angle.'), imaginary: 1 }, 'REDIRECT', 'Redirect the vector formation with i.', 'vectors', 3),
      phase('The protected point', 'e^(iπ) [e^(iθ)] + Σ + d/dt + ∫', angle('Angular counter · π/2', 0, 1, 'e^(iπ/2)', 'The shield leaves one angular opening.'), 'ORBIT', 'Reach the protected point through angular control.', 'waves', 3),
      { ...phase('One against many', 'e^(iπ) + [Σ] + d/dt + ∫', single('Repeated counter · 8', 'sum', 8, 'Σ₁⁴ 2', 'Four repeated pulses of two meet the formation.'), 'REPEAT', 'Use summation to clear the repeated formation.', 'bolts', 2), unlock: ['sum(1,1,4)', 'sum(2,1,4)', 'sum(n,1,4)'], intro: 'Σ repeats an effect. Choose the term; the bounds count the repetitions.' },
      { ...phase('A moment of stillness', 'e^(iπ) + [d/dt] + ∫', single('Rate at t = 0 · 0', 'derivative', 0, 'd/dt(t²)', 'At t = 0, the derivative of t² is zero.'), 'ACCELERATE', 'Find zero velocity and expose the changing term.', 'vectors', 2), unlock: ['diff(t^2)', 'diff(t^3)', 'diff(sin(t))'], intro: 'A derivative reveals how quickly something changes.' },
      { ...phase('What remains', 'e^(iπ) + [∫]', single('Accumulated area · 8', 'integral', 8, '∫₀⁴ t dt', 'The area under t from zero to four is eight.'), 'ACCUMULATE', 'Accumulate eight units of cover. Survive the collapse.', 'waves', 2), unlock: ['integral(t,0,2)', 'integral(t,0,4)', 'integral(2,0,4)'], intro: 'An integral gathers a changing quantity into a whole.' },
    ],
  },
];

export function unlockedThrough(encounter: number, beatIndex = 0): string[] {
  const tokens = new Set<string>();
  for (let i = 0; i <= encounter; i++) {
    const entry = CAMPAIGN[i];
    entry.unlock.forEach(t => tokens.add(t));
    const steps = entry.phases ?? entry.beats;
    steps.slice(0, i === encounter ? beatIndex + 1 : undefined).forEach(b => b.unlock?.forEach(t => tokens.add(t)));
  }
  return [...tokens];
}
