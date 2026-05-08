import { describe, expect, it } from 'vitest';
import { emitTailwindTheme } from '../src/emit-tailwind.js';

describe('emitTailwindTheme', () => {
  it('maps colors / spacing / radius / fontSize into the Tailwind theme shape', () => {
    const tokens = {
      color: {
        primary: { $type: 'color', $value: '#3366ff' },
        surface: { $type: 'color', $value: '#ffffff' },
      },
      spacing: {
        '4': { $type: 'dimension', $value: '16px' },
        '8': { $type: 'dimension', $value: '32px' },
      },
      radius: {
        sm: { $type: 'dimension', $value: '4px' },
      },
      'font-size': {
        body: { $type: 'dimension', $value: '14px' },
      },
    };
    const out = emitTailwindTheme(tokens);
    expect(out.colors).toEqual({ primary: '#3366ff', surface: '#ffffff' });
    expect(out.spacing).toEqual({ '4': '16px', '8': '32px' });
    expect(out.borderRadius).toEqual({ sm: '4px' });
    expect(out.fontSize.body).toEqual(['14px', {}]);
  });

  it('flattens nested color groups using dot path', () => {
    const tokens = {
      color: {
        brand: {
          500: { $type: 'color', $value: '#3366ff' },
          600: { $type: 'color', $value: '#2855cc' },
        },
      },
    };
    const out = emitTailwindTheme(tokens);
    expect(out.colors['brand.500']).toBe('#3366ff');
    expect(out.colors['brand.600']).toBe('#2855cc');
  });

  it('returns empty maps when no tokens are present', () => {
    const out = emitTailwindTheme({});
    expect(out.colors).toEqual({});
    expect(out.spacing).toEqual({});
  });
});
