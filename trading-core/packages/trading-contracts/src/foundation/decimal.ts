/**
 * FixedDecimal provides exact fixed-point decimal arithmetic for financial calculations,
 * avoiding IEEE-754 binary floating point precision drift, dust over-allocations, and rounding anomalies.
 */
export class FixedDecimal {
  private static readonly SCALE = 12n;
  private static readonly FACTOR = 1_000_000_000_000n; // 10^12

  public readonly raw: bigint;

  private constructor(raw: bigint) {
    this.raw = raw;
  }

  public static from(value: string | number | bigint | FixedDecimal): FixedDecimal {
    if (value instanceof FixedDecimal) return value;
    if (typeof value === 'bigint') {
      return new FixedDecimal(value * FixedDecimal.FACTOR);
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`Cannot construct FixedDecimal from non-finite number: ${value}`);
      }
      return FixedDecimal.fromString(value.toString());
    }
    if (typeof value === 'string') {
      return FixedDecimal.fromString(value.trim());
    }
    throw new Error(`Unsupported value type for FixedDecimal: ${typeof value}`);
  }

  private static fromString(str: string): FixedDecimal {
    if (!str || str.length === 0) {
      throw new Error('Cannot construct FixedDecimal from empty string');
    }
    let s = str;
    const isNegative = s.startsWith('-');
    if (isNegative || s.startsWith('+')) {
      s = s.slice(1);
    }

    const parts = s.split('.');
    if (parts.length > 2) {
      throw new Error(`Invalid decimal string: ${str}`);
    }

    const intPartStr = parts[0] || '0';
    if (!/^\d+$/.test(intPartStr)) {
      throw new Error(`Invalid integer part in decimal: ${str}`);
    }
    const intPart = BigInt(intPartStr);

    let fracPartStr = parts[1] || '';
    if (fracPartStr.length > 0 && !/^\d+$/.test(fracPartStr)) {
      throw new Error(`Invalid fractional part in decimal: ${str}`);
    }

    if (fracPartStr.length > 12) {
      fracPartStr = fracPartStr.slice(0, 12);
    } else {
      fracPartStr = fracPartStr.padEnd(12, '0');
    }
    const fracPart = BigInt(fracPartStr);

    const rawUnsigned = intPart * FixedDecimal.FACTOR + fracPart;
    const raw = isNegative ? -rawUnsigned : rawUnsigned;
    return new FixedDecimal(raw);
  }

  public static zero(): FixedDecimal {
    return new FixedDecimal(0n);
  }

  public add(other: string | number | bigint | FixedDecimal): FixedDecimal {
    const o = FixedDecimal.from(other);
    return new FixedDecimal(this.raw + o.raw);
  }

  public sub(other: string | number | bigint | FixedDecimal): FixedDecimal {
    const o = FixedDecimal.from(other);
    return new FixedDecimal(this.raw - o.raw);
  }

  public mul(other: string | number | bigint | FixedDecimal): FixedDecimal {
    const o = FixedDecimal.from(other);
    const product = (this.raw * o.raw) / FixedDecimal.FACTOR;
    return new FixedDecimal(product);
  }

  public div(other: string | number | bigint | FixedDecimal): FixedDecimal {
    const o = FixedDecimal.from(other);
    if (o.raw === 0n) {
      throw new Error('Division by zero in FixedDecimal');
    }
    const quotient = (this.raw * FixedDecimal.FACTOR) / o.raw;
    return new FixedDecimal(quotient);
  }

  public abs(): FixedDecimal {
    return this.raw < 0n ? new FixedDecimal(-this.raw) : this;
  }

  public eq(other: string | number | bigint | FixedDecimal): boolean {
    return this.raw === FixedDecimal.from(other).raw;
  }

  public lt(other: string | number | bigint | FixedDecimal): boolean {
    return this.raw < FixedDecimal.from(other).raw;
  }

  public lte(other: string | number | bigint | FixedDecimal): boolean {
    return this.raw <= FixedDecimal.from(other).raw;
  }

  public gt(other: string | number | bigint | FixedDecimal): boolean {
    return this.raw > FixedDecimal.from(other).raw;
  }

  public gte(other: string | number | bigint | FixedDecimal): boolean {
    return this.raw >= FixedDecimal.from(other).raw;
  }

  public isZero(): boolean {
    return this.raw === 0n;
  }

  public isPositive(): boolean {
    return this.raw > 0n;
  }

  public isNegative(): boolean {
    return this.raw < 0n;
  }

  public min(other: string | number | bigint | FixedDecimal): FixedDecimal {
    const o = FixedDecimal.from(other);
    return this.raw <= o.raw ? this : o;
  }

  public max(other: string | number | bigint | FixedDecimal): FixedDecimal {
    const o = FixedDecimal.from(other);
    return this.raw >= o.raw ? this : o;
  }

  public static min(first: string | number | bigint | FixedDecimal, ...rest: (string | number | bigint | FixedDecimal)[]): FixedDecimal {
    let m = FixedDecimal.from(first);
    for (const item of rest) {
      const dec = FixedDecimal.from(item);
      if (dec.raw < m.raw) m = dec;
    }
    return m;
  }

  public static max(first: string | number | bigint | FixedDecimal, ...rest: (string | number | bigint | FixedDecimal)[]): FixedDecimal {
    let m = FixedDecimal.from(first);
    for (const item of rest) {
      const dec = FixedDecimal.from(item);
      if (dec.raw > m.raw) m = dec;
    }
    return m;
  }

  public static sum(...items: (string | number | bigint | FixedDecimal)[]): FixedDecimal {
    let s = FixedDecimal.zero();
    for (const item of items) {
      s = s.add(item);
    }
    return s;
  }

  public toString(): string {
    if (this.raw === 0n) return '0';
    const isNeg = this.raw < 0n;
    const absVal = isNeg ? -this.raw : this.raw;
    const intPart = absVal / FixedDecimal.FACTOR;
    const fracPart = absVal % FixedDecimal.FACTOR;

    if (fracPart === 0n) {
      return `${isNeg ? '-' : ''}${intPart.toString()}`;
    }

    const fracStr = fracPart.toString().padStart(12, '0').replace(/0+$/, '');
    return `${isNeg ? '-' : ''}${intPart.toString()}.${fracStr}`;
  }

  public toNumber(): number {
    return Number(this.toString());
  }
}
