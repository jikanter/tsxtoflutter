import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDGET_CATALOG,
  getDesignToken,
  lookupWidgetCatalog,
  parseAnalyzerOutput,
  renderWidgetScreenshot,
} from '../src/index.js';

describe('lookupWidgetCatalog', () => {
  it('matches by name first', () => {
    const hits = lookupWidgetCatalog('FilledButton', DEFAULT_WIDGET_CATALOG);
    expect(hits[0]?.name).toBe('FilledButton');
  });

  it('returns adaptive shim when present', () => {
    const hits = lookupWidgetCatalog('switch', DEFAULT_WIDGET_CATALOG);
    expect(hits[0]?.adaptive).toBe('AppSwitch');
  });

  it('caps results at 5', () => {
    const hits = lookupWidgetCatalog('button card row column padding sized', DEFAULT_WIDGET_CATALOG);
    expect(hits.length).toBeLessThanOrEqual(5);
  });

  it('returns empty for empty queries', () => {
    expect(lookupWidgetCatalog('', DEFAULT_WIDGET_CATALOG)).toEqual([]);
    expect(lookupWidgetCatalog('   ', DEFAULT_WIDGET_CATALOG)).toEqual([]);
  });
});

describe('getDesignToken', () => {
  const resolved = {
    color: { brand: { '500': { $value: '#3B82F6', $type: 'color' } } },
    spacing: { md: { $value: 16, $type: 'dimension' } },
  };

  it('resolves dot paths', async () => {
    const out = await getDesignToken('color.brand.500', { resolved });
    expect(out).toEqual({ value: '#3B82F6', type: 'color' });
  });

  it('errors on missing path', async () => {
    await expect(getDesignToken('color.missing', { resolved })).rejects.toThrow(/not found/);
  });

  it('errors when path lands on a group, not a leaf', async () => {
    await expect(getDesignToken('color.brand', { resolved })).rejects.toThrow(/group, not a leaf/);
  });
});

describe('parseAnalyzerOutput', () => {
  it('parses error / warning / info lines from machine output', () => {
    const stdout = [
      '   error • Undefined name "Foo" • lib/main.dart:10:5 • undefined_identifier',
      '   warning • Dead code • lib/main.dart:20:1 • dead_code',
      '   info • Prefer const • lib/main.dart:5:3 • prefer_const_constructors',
      'extra junk that is not a diagnostic',
    ].join('\n');
    const result = parseAnalyzerOutput(stdout);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe('undefined_identifier');
    expect(result.errors[0]?.line).toBe(10);
    expect(result.warnings).toHaveLength(1);
    expect(result.infos).toHaveLength(1);
  });

  it('returns an empty result on clean output', () => {
    expect(parseAnalyzerOutput('No issues found.')).toEqual({ errors: [], warnings: [], infos: [] });
  });
});

describe('renderWidgetScreenshot', () => {
  it('throws when no headless renderer is wired', async () => {
    await expect(renderWidgetScreenshot('void main() {}')).rejects.toThrow(
      /not yet wired/,
    );
  });

  it('uses the injected renderer and reports dimensions', async () => {
    const out = await renderWidgetScreenshot('void main() {}', {
      width: 320,
      height: 200,
      render: async () => 'iVBORw0KGgo=',
    });
    expect(out.width).toBe(320);
    expect(out.height).toBe(200);
    expect(out.png_base64).toBe('iVBORw0KGgo=');
  });
});
