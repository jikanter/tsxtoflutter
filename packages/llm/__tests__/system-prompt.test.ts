import { describe, expect, it } from 'vitest';
import {
  assertSingleCacheBreakpoint,
  buildSystemPrompt,
  DEFAULT_TOOLS,
  DEFAULT_WIDGET_CATALOG,
} from '../src/system-prompt.js';

describe('buildSystemPrompt', () => {
  const opts = {
    widgetCatalog: [...DEFAULT_WIDGET_CATALOG],
    tokenPaths: ['color.brand.500', 'spacing.md'],
    tier: 'sonnet' as const,
  };

  it('places exactly one cache_control breakpoint on the LAST block', () => {
    const blocks = buildSystemPrompt(opts);
    const breakpoints = blocks.filter((b) => b.cache_control !== undefined);
    expect(breakpoints).toHaveLength(1);
    const last = blocks[blocks.length - 1];
    expect(last?.cache_control?.type).toBe('ephemeral');
    expect(last?.cache_control?.ttl).toBe('5m');
  });

  it('honours nightly batch TTL flag', () => {
    const blocks = buildSystemPrompt({ ...opts, ttl: '1h' });
    const last = blocks[blocks.length - 1];
    expect(last?.cache_control?.ttl).toBe('1h');
  });

  it('includes the widget catalog and token map in the prompt body', () => {
    const blocks = buildSystemPrompt(opts);
    const text = blocks.map((b) => b.text).join('\n');
    expect(text).toContain('FilledButton');
    expect(text).toContain('color.brand.500');
  });

  it('frames Sonnet vs Opus tiers differently', () => {
    const sonnet = buildSystemPrompt(opts).map((b) => b.text).join('\n');
    const opus = buildSystemPrompt({ ...opts, tier: 'opus' }).map((b) => b.text).join('\n');
    expect(sonnet).toContain('Sonnet');
    expect(opus).toContain('Opus');
  });

  it('assertSingleCacheBreakpoint enforces the invariant', () => {
    const blocks = buildSystemPrompt(opts);
    expect(() => assertSingleCacheBreakpoint(blocks)).not.toThrow();

    const broken = blocks.map((b) => ({ ...b }));
    broken[0] = { ...broken[0]!, cache_control: { type: 'ephemeral' } };
    expect(() => assertSingleCacheBreakpoint(broken)).toThrow();
  });

  it('exposes the four phase-3 tools', () => {
    const names = DEFAULT_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      ['get_design_token', 'lookup_widget_catalog', 'render_widget_screenshot', 'run_flutter_analyze'],
    );
  });
});
