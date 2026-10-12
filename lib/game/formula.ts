// The formula language units and upgrades carry their logic in (see
// docs/content.md). Content is data, and later some of it is written by an
// AI, so formulas are parsed here and never run as code: they can only do
// arithmetic, compare, and read the stats, units and upgrades below.
// Anything else, including a unit or upgrade that doesn't exist, fails when
// the formula is compiled, so broken content fails on load.

// The stats a formula can read, named as in player_stats ("gold" is the
// Gold the player holds).
export const STATS = [
  "gold",
  "run_clicks",
  "run_click_gold",
  "run_gold_earned",
  "total_clicks",
  "total_gold_earned",
] as const;

export type Stat = (typeof STATS)[number];

export type FormulaState = {
  stats: Record<Stat, number>;
  owned: Readonly<Record<string, number>>;
  bought: ReadonlySet<string>;
};

// The units and upgrades that exist, so owned() and bought() can be checked.
export type KnownIds = {
  units: ReadonlySet<string>;
  upgrades: ReadonlySet<string>;
};

export type Formula = (state: FormulaState) => number;

export class FormulaError extends Error {}

// Longer than any formula a person or the AI should need.
const MAX_LENGTH = 500;

// Comparisons, and/or/not give 1 or 0. Zero and NaN count as false.
export function truthy(value: number): boolean {
  return value !== 0 && !Number.isNaN(value);
}

const bool = (value: boolean) => (value ? 1 : 0);

const FUNCTIONS: Record<string, { min: number; max: number; apply: (args: number[]) => number }> = {
  min: { min: 1, max: Infinity, apply: (args) => Math.min(...args) },
  max: { min: 1, max: Infinity, apply: (args) => Math.max(...args) },
  floor: { min: 1, max: 1, apply: ([x]) => Math.floor(x) },
  log10: { min: 1, max: 1, apply: ([x]) => Math.log10(x) },
};

const COMPARISONS: Record<string, (a: number, b: number) => boolean> = {
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
};

type Token =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "string"; value: string }
  | { kind: "symbol"; value: string };

const TOKEN = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([a-z_][a-z0-9_]*)|'([a-z0-9_]*)'|(<=|>=|==|!=|[-+*/^()<>,]))/y;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (source.slice(TOKEN.lastIndex).trim() !== "") {
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match) throw new FormulaError(`Unexpected "${source.slice(start).trim().slice(0, 10)}"`);
    const [, number, name, string, symbol] = match;
    if (number !== undefined) tokens.push({ kind: "number", value: Number(number) });
    else if (name !== undefined) tokens.push({ kind: "name", value: name });
    else if (string !== undefined) tokens.push({ kind: "string", value: string });
    else tokens.push({ kind: "symbol", value: symbol });
  }
  return tokens;
}

// Compiles a formula into a function of the player's state, or throws
// FormulaError. Precedence, loosest first: or, and, not, comparisons,
// + -, * /, unary minus, ^ (right to left).
export function compileFormula(source: string, known: KnownIds): Formula {
  if (source.length > MAX_LENGTH) throw new FormulaError(`Longer than ${MAX_LENGTH} characters`);
  const tokens = tokenize(source);
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const isSymbol = (value: string) => peek()?.kind === "symbol" && peek()?.value === value;
  const isWord = (value: string) => peek()?.kind === "name" && peek()?.value === value;
  function expect(value: string) {
    if (!isSymbol(value)) throw new FormulaError(`Expected "${value}"`);
    pos++;
  }

  function or(): Formula {
    let left = and();
    while (isWord("or")) {
      pos++;
      const [a, b] = [left, and()];
      left = (s) => bool(truthy(a(s)) || truthy(b(s)));
    }
    return left;
  }

  function and(): Formula {
    let left = not();
    while (isWord("and")) {
      pos++;
      const [a, b] = [left, not()];
      left = (s) => bool(truthy(a(s)) && truthy(b(s)));
    }
    return left;
  }

  function not(): Formula {
    if (isWord("not")) {
      pos++;
      const a = not();
      return (s) => bool(!truthy(a(s)));
    }
    return comparison();
  }

  function comparison(): Formula {
    const left = additive();
    const token = peek();
    if (token?.kind !== "symbol" || !(token.value in COMPARISONS)) return left;
    pos++;
    const compare = COMPARISONS[token.value];
    const right = additive();
    return (s) => bool(compare(left(s), right(s)));
  }

  function additive(): Formula {
    let left = multiplicative();
    while (isSymbol("+") || isSymbol("-")) {
      const minus = isSymbol("-");
      pos++;
      const [a, b] = [left, multiplicative()];
      left = minus ? (s) => a(s) - b(s) : (s) => a(s) + b(s);
    }
    return left;
  }

  function multiplicative(): Formula {
    let left = unary();
    while (isSymbol("*") || isSymbol("/")) {
      const divide = isSymbol("/");
      pos++;
      const [a, b] = [left, unary()];
      left = divide ? (s) => a(s) / b(s) : (s) => a(s) * b(s);
    }
    return left;
  }

  function unary(): Formula {
    if (isSymbol("-")) {
      pos++;
      const a = unary();
      return (s) => -a(s);
    }
    return power();
  }

  function power(): Formula {
    const base = primary();
    if (!isSymbol("^")) return base;
    pos++;
    const exponent = unary();
    return (s) => base(s) ** exponent(s);
  }

  function primary(): Formula {
    const token = peek();
    if (!token) throw new FormulaError("Unexpected end");
    pos++;

    if (token.kind === "number") return () => token.value;
    if (token.kind === "symbol" && token.value === "(") {
      const inner = or();
      expect(")");
      return inner;
    }
    if (token.kind !== "name") throw new FormulaError(`Unexpected "${token.value}"`);

    const name = token.value;
    if (name === "true") return () => 1;
    if (name === "false") return () => 0;
    if ((STATS as readonly string[]).includes(name)) return (s) => s.stats[name as Stat];
    if (name === "owned" || name === "bought") return lookup(name);

    const fn = FUNCTIONS[name];
    if (!fn) throw new FormulaError(`Unknown name "${name}"`);
    expect("(");
    const args = [or()];
    while (isSymbol(",")) {
      pos++;
      args.push(or());
    }
    expect(")");
    if (args.length < fn.min || args.length > fn.max) throw new FormulaError(`Wrong number of arguments to ${name}`);
    return (s) => fn.apply(args.map((arg) => arg(s)));
  }

  // owned('unit') or bought('upgrade'), whose id must exist.
  function lookup(name: "owned" | "bought"): Formula {
    expect("(");
    const id = peek();
    if (id?.kind !== "string") throw new FormulaError(`${name}() takes a quoted id`);
    pos++;
    expect(")");
    if (name === "owned") {
      if (!known.units.has(id.value)) throw new FormulaError(`No unit "${id.value}"`);
      return (s) => s.owned[id.value] ?? 0;
    }
    if (!known.upgrades.has(id.value)) throw new FormulaError(`No upgrade "${id.value}"`);
    return (s) => bool(s.bought.has(id.value));
  }

  const formula = or();
  if (pos < tokens.length) throw new FormulaError(`Unexpected "${String(tokens[pos].value)}"`);
  return formula;
}
