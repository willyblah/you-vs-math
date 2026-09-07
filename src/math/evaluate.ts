export type Expression =
  | { type: 'number'; value: number }
  | { type: 'constant'; name: 'pi' | 'i' | 'e' | 't' | 'n' }
  | { type: 'unary'; value: Expression }
  | { type: 'binary'; op: string; left: Expression; right: Expression }
  | { type: 'call'; name: string; args: Expression[] };

export interface Value { re: number; im: number; rational?: [number, number] }
export interface EvaluationResult {
  valid: boolean; value?: Value; expression?: Expression; display: string; steps: string[]; error?: string; position?: number;
}
const EPS = 1e-8;
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : Math.abs(a); }
function rational(n: number, d = 1): Value {
  if (!d) throw new Error('Cannot divide by zero');
  const g = gcd(n, d) || 1;
  const sign = d < 0 ? -1 : 1;
  return { re: n / d, im: 0, rational: [sign * n / g, sign * d / g] };
}
function complex(re: number, im = 0): Value {
  return { re: Math.abs(re) < EPS ? 0 : re, im: Math.abs(im) < EPS ? 0 : im };
}
export function equal(a: Value, re: number, im = 0): boolean { return Math.abs(a.re - re) < EPS && Math.abs(a.im - im) < EPS; }
export function format(v: Value): string {
  if (v.rational && v.rational[1] !== 1) return `${v.rational[0]}/${v.rational[1]}`;
  const real = Math.abs(v.re) < EPS ? 0 : +v.re.toFixed(3);
  const imaginary = Math.abs(v.im) < EPS ? 0 : +v.im.toFixed(3);
  if (!imaginary) return String(real);
  const iterm = Math.abs(imaginary) === 1 ? 'i' : `${Math.abs(imaginary)}i`;
  return real ? `${real} ${imaginary < 0 ? '−' : '+'} ${iterm}` : `${imaginary < 0 ? '−' : ''}${iterm}`;
}
function binary(op: string, a: Value, b: Value): Value {
  if (a.rational && b.rational && ['+', '-', '*', '/'].includes(op)) {
    const [an, ad] = a.rational, [bn, bd] = b.rational;
    if (op === '+') return rational(an * bd + bn * ad, ad * bd);
    if (op === '-') return rational(an * bd - bn * ad, ad * bd);
    if (op === '*') return rational(an * bn, ad * bd);
    return rational(an * bd, ad * bn);
  }
  if (op === '+') return complex(a.re + b.re, a.im + b.im);
  if (op === '-') return complex(a.re - b.re, a.im - b.im);
  if (op === '*') return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  if (op === '/') {
    const den = b.re * b.re + b.im * b.im;
    if (den < EPS) throw new Error('Cannot divide by zero');
    return complex((a.re * b.re + a.im * b.im) / den, (a.im * b.re - a.re * b.im) / den);
  }
  if (op === '^') {
    if (a.re === Math.E && !a.im) return complex(Math.exp(b.re) * Math.cos(b.im), Math.exp(b.re) * Math.sin(b.im));
    if (b.im || !Number.isInteger(b.re) || Math.abs(b.re) > 12) throw new Error('Use an integer power from −12 to 12');
    if (!a.re && !a.im && b.re <= 0) throw new Error('This power is undefined');
    let result = rational(1);
    for (let j = 0; j < Math.abs(b.re); j++) result = binary('*', result, a);
    return b.re < 0 ? binary('/', rational(1), result) : result;
  }
  throw new Error('Unknown operator');
}
const names = ['sqrt', 'sin', 'cos', 'exp', 'sum', 'diff', 'integral'];
interface Lexeme { text: string; at: number }
class Parser {
  tokens: Lexeme[] = []; index = 0;
  constructor(source: string) {
    const normalized = source.replaceAll('π', 'pi').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replaceAll('θ', 't');
    const regex = /\s+|\d+(?:\.\d+)?|integral|sqrt|sin|cos|exp|sum|diff|pi|[ietn]|[+\-*/^(),]/gy;
    let at = 0;
    while (at < normalized.length) {
      regex.lastIndex = at;
      const match = regex.exec(normalized);
      if (!match) throw Object.assign(new Error('This connection is not supported'), { position: at });
      if (match[0].trim()) this.tokens.push({ text: match[0], at });
      at = regex.lastIndex;
    }
  }
  peek(): string { return this.tokens[this.index]?.text ?? ''; }
  take(): string { return this.tokens[this.index++]?.text ?? ''; }
  fail(message: string): never { throw Object.assign(new Error(message), { position: this.tokens[this.index]?.at ?? 0 }); }
  parse(min = 0): Expression {
    const token = this.take();
    let left: Expression;
    if (!token) this.fail('An operand is missing');
    if (token === '-') left = { type: 'unary', value: this.parse(25) };
    else if (token === '(') { left = this.parse(); if (this.take() !== ')') this.fail('Close the parentheses'); }
    else if (/^\d/.test(token)) left = { type: 'number', value: Number(token) };
    else if (['pi', 'i', 'e', 't', 'n'].includes(token)) left = { type: 'constant', name: token as 'pi' };
    else if (names.includes(token)) {
      if (this.take() !== '(') this.fail('Add a function input');
      const args = [this.parse()];
      while (this.peek() === ',') { this.take(); args.push(this.parse()); }
      if (this.take() !== ')') this.fail('Close the function');
      left = { type: 'call', name: token, args };
    } else this.fail('An operand belongs here');
    while (this.peek()) {
      const next = this.peek();
      const implicit = next === '(' || /^[a-z\d]/.test(next);
      const op = implicit ? '*' : next;
      const precedence = ({ '+': 10, '-': 10, '*': 20, '/': 20, '^': 30 } as Record<string, number>)[op] ?? -1;
      if (precedence < min) break;
      if (!implicit) this.take();
      const right = this.parse(op === '^' ? precedence : precedence + 1);
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
}
type Environment = { t: number; n: number };
function derivative(node: Expression, env: Environment): Value {
  if (node.type === 'number' || node.type === 'constant' && node.name !== 't') return rational(0);
  if (node.type === 'constant') return rational(1);
  if (node.type === 'binary' && node.op === '^' && node.left.type === 'constant' && node.left.name === 't' && node.right.type === 'number') {
    const p = node.right.value;
    return complex(p * Math.pow(env.t, p - 1));
  }
  if (node.type === 'call' && node.args[0]?.type === 'constant' && node.args[0].name === 't') {
    if (node.name === 'sin') return complex(Math.cos(env.t));
    if (node.name === 'cos') return complex(-Math.sin(env.t));
  }
  throw new Error('Use an authored rate: t, t², t³, sin(t), or cos(t)');
}
function antiderivative(node: Expression, x: number): number {
  if (node.type === 'number') return node.value * x;
  if (node.type === 'constant' && node.name === 't') return x * x / 2;
  if (node.type === 'binary' && node.op === '^' && node.left.type === 'constant' && node.left.name === 't' && node.right.type === 'number' && node.right.value >= 0) {
    const p = node.right.value + 1; return Math.pow(x, p) / p;
  }
  if (node.type === 'call' && node.args[0]?.type === 'constant' && node.args[0].name === 't') {
    if (node.name === 'sin') return -Math.cos(x);
    if (node.name === 'cos') return Math.sin(x);
  }
  throw new Error('Use an authored area: constant, t, t², sin(t), or cos(t)');
}
function run(node: Expression, env: Environment): Value {
  if (node.type === 'number') return Number.isInteger(node.value) ? rational(node.value) : complex(node.value);
  if (node.type === 'constant') {
    if (node.name === 'i') return complex(0, 1);
    if (node.name === 'pi') return complex(Math.PI);
    if (node.name === 'e') return complex(Math.E);
    return complex(env[node.name]);
  }
  if (node.type === 'unary') return binary('*', rational(-1), run(node.value, env));
  if (node.type === 'binary') return binary(node.op, run(node.left, env), run(node.right, env));
  const { name, args } = node;
  const arity = name === 'sum' || name === 'integral' ? 3 : 1;
  if (args.length !== arity) throw new Error(`${name} needs ${arity} input${arity === 1 ? '' : 's'}`);
  if (name === 'diff') return derivative(args[0], env);
  if (name === 'sum') {
    const start = run(args[1], env), end = run(args[2], env);
    if (start.im || end.im || !Number.isInteger(start.re) || !Number.isInteger(end.re) || end.re < start.re || end.re - start.re > 24) throw new Error('Use an increasing sum of at most 25 terms');
    let total = rational(0);
    for (let n = start.re; n <= end.re; n++) total = binary('+', total, run(args[0], { ...env, n }));
    return total;
  }
  if (name === 'integral') {
    const a = run(args[1], env), b = run(args[2], env);
    if (a.im || b.im) throw new Error('Area bounds must be real');
    return complex(antiderivative(args[0], b.re) - antiderivative(args[0], a.re));
  }
  const a = run(args[0], env);
  if (name === 'sqrt') {
    const radius = Math.hypot(a.re, a.im), theta = Math.atan2(a.im, a.re) / 2;
    return complex(Math.sqrt(radius) * Math.cos(theta), Math.sqrt(radius) * Math.sin(theta));
  }
  if (name === 'exp') return complex(Math.exp(a.re) * Math.cos(a.im), Math.exp(a.re) * Math.sin(a.im));
  if (a.im) throw new Error('Use a real angle');
  return complex(name === 'sin' ? Math.sin(a.re) : Math.cos(a.re));
}
export function evaluate(source: string, t = 0): EvaluationResult {
  try {
    const parser = new Parser(source);
    const expression = parser.parse();
    if (parser.peek()) parser.fail('These terms do not connect');
    const value = run(expression, { t, n: 0 });
    if (!Number.isFinite(value.re) || !Number.isFinite(value.im) || Math.hypot(value.re, value.im) > 1e6) throw new Error('This result is too large for the arena');
    const steps: string[] = [];
    if (expression.type === 'binary') {
      for (const part of [expression.left, expression.right]) {
        if (part.type === 'binary' || part.type === 'call') steps.push(format(run(part, { t, n: 0 })));
      }
    }
    steps.push(format(value));
    return { valid: true, expression, value, display: format(value), steps };
  } catch (error) {
    const err = error as Error & { position?: number };
    return { valid: false, display: '…', steps: [], error: err.message, position: err.position };
  }
}

/** Display-only typography; parsing always uses the original source. */
export function notation(source: string): string {
  return source.replaceAll('integral(t,0,4)', '∫₀⁴ t dt').replaceAll('integral(2,0,4)', '∫₀⁴ 2 dt')
    .replaceAll('integral(t,0,2)', '∫₀² t dt').replaceAll('sum(n,1,4)', 'Σ₁⁴ n').replaceAll('sum(1,1,4)', 'Σ₁⁴ 1')
    .replaceAll('sum(2,1,4)', 'Σ₁⁴ 2').replaceAll('diff(t^2)', 'd/dt(t²)').replaceAll('diff(t^3)', 'd/dt(t³)')
    .replaceAll('diff(sin(t))', 'd/dt sin(t)').replaceAll('sqrt', '√').replaceAll('pi', 'π')
    .replaceAll('^2', '²').replaceAll('^3', '³').replaceAll('*', '×').replaceAll('-', '−');
}
