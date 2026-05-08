import { describe, expect, it } from 'vitest';
import { resolveAliases, parseDtcg, DtcgCycleError } from '../src/dtcg.js';

describe('parseDtcg', () => {
  it('accepts a valid token tree and returns it untouched', () => {
    const input = {
      color: {
        brand: {
          $type: 'color',
          500: { $value: '#3366ff' },
        },
      },
    };
    expect(parseDtcg(input)).toEqual(input);
  });

  it('rejects non-object input', () => {
    expect(() => parseDtcg(null)).toThrow();
    expect(() => parseDtcg(42)).toThrow();
    expect(() => parseDtcg('nope')).toThrow();
  });
});

describe('resolveAliases', () => {
  it('resolves a one-hop alias against an absolute path', () => {
    const tokens = {
      color: {
        brand: { $type: 'color', $value: '#ff0000' },
        primary: { $type: 'color', $value: '{color.brand}' },
      },
    };
    const out = resolveAliases(tokens) as typeof tokens;
    expect(out.color.primary.$value).toBe('#ff0000');
  });

  it('resolves nested aliases', () => {
    const tokens = {
      color: {
        a: { $type: 'color', $value: '#000' },
        b: { $type: 'color', $value: '{color.a}' },
        c: { $type: 'color', $value: '{color.b}' },
      },
    };
    const out = resolveAliases(tokens) as typeof tokens;
    expect(out.color.c.$value).toBe('#000');
  });

  it('throws DtcgCycleError on a cycle and includes the cycle path', () => {
    const tokens = {
      color: {
        a: { $type: 'color', $value: '{color.b}' },
        b: { $type: 'color', $value: '{color.a}' },
      },
    };
    expect(() => resolveAliases(tokens)).toThrow(DtcgCycleError);
    try {
      resolveAliases(tokens);
    } catch (e) {
      expect(e).toBeInstanceOf(DtcgCycleError);
      expect((e as DtcgCycleError).cyclePath.join(' -> ')).toMatch(/color\.a.*color\.b.*color\.a/);
    }
  });

  it('throws on an alias that does not resolve', () => {
    const tokens = {
      color: { x: { $type: 'color', $value: '{color.missing}' } },
    };
    expect(() => resolveAliases(tokens)).toThrow(/missing/);
  });

  it('leaves non-alias values intact', () => {
    const tokens = {
      spacing: { 4: { $type: 'dimension', $value: '16px' } },
    };
    const out = resolveAliases(tokens) as typeof tokens;
    expect(out.spacing[4].$value).toBe('16px');
  });
});
