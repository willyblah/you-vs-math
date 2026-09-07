import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { evaluate, equal } from './evaluate.ts';
import { CAMPAIGN, unlockedThrough } from '../content/campaign.ts';

test('arithmetic, fractions, precedence, and equivalent inputs', () => {
  for (const [source, re] of [['2+2', 4], ['2*2', 4], ['2+3*4', 14], ['-2^2', -4], ['2^3', 8], ['1/2+1/4', .75], ['sqrt(16)', 4]] as const) {
    const result = evaluate(source); assert.ok(result.valid, source); assert.ok(equal(result.value!, re), source);
  }
  assert.equal(evaluate('1/2+1/4').display, '3/4');
});
test('imaginary unlock, Euler identity, and quarter turns', () => {
  for (const [source, re, im] of [['sqrt(-1)', 0, 1], ['i*i', -1, 0], ['i^4', 1, 0], ['e^(i*pi)+1', 0, 0], ['e^(iπ)+1', 0, 0], ['e^(i*pi/2)', 0, 1], ['cos(pi/2)+i*sin(pi/2)', 0, 1]] as const) {
    const result = evaluate(source); assert.ok(result.valid, source); assert.ok(equal(result.value!, re, im), source);
  }
});
test('authored summation and calculus', () => {
  assert.equal(evaluate('sum(n,1,4)').value!.re, 10);
  assert.equal(evaluate('sum(2,1,4)').value!.re, 8);
  assert.equal(evaluate('diff(t^2)', 3).value!.re, 6);
  assert.equal(evaluate('diff(sin(t))').value!.re, 1);
  assert.equal(evaluate('integral(t,0,4)').value!.re, 8);
});
test('invalid expressions stay inactive', () => {
  for (const source of ['1/0', '2+', 'sqrt(', 'sum(1,1,100)', '0^0', 'sin(i)', 'diff(t,t)', 'alert(1)']) assert.equal(evaluate(source).valid, false, source);
});

test('every authored rail has a solution using its unlocked physical tokens', () => {
  CAMPAIGN.forEach((encounter, encounterIndex) => {
    (encounter.phases ?? encounter.beats).forEach((beat, beatIndex) => {
      const tokens = unlockedThrough(encounterIndex, beatIndex), spec = beat.rail;
      const choices = spec.slots.map(type => tokens.filter(token => {
        const operator = ['+', '-', '*', '/', '^'].includes(token);
        return type === 'operator' ? operator : !operator && (type !== 'angle' || evaluate(token).value?.im === 0);
      }));
      const operation = ({ sum: 'sum(', derivative: 'diff(', integral: 'integral(' } as Record<string, string>)[spec.effect];
      const find = (index: number, terms: string[]): boolean => {
        if (index < choices.length) return choices[index].some(token => find(index + 1, [...terms, token]));
        const source = `${spec.prefix ?? ''}${terms.join('')}${spec.suffix ?? ''}`;
        if (operation && !source.includes(operation)) return false;
        const result = evaluate(source);
        return result.valid && equal(result.value!, spec.target, spec.imaginary ?? 0);
      };
      assert.ok(find(0, []), `${encounter.title}: ${beat.name}`);
    });
  });
});
