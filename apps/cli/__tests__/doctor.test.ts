import { describe, expect, it } from 'vitest';
import {
  parseFlutterVersion,
  parseDartVersion,
  parseSemverLike,
  evaluateChecks,
  REQUIREMENTS,
  type Probe,
} from '../src/commands/doctor.js';

describe('doctor: parsers', () => {
  it('parses `Flutter 3.41.9 • channel stable • ...` ', () => {
    expect(parseFlutterVersion('Flutter 3.41.9 • channel stable • ...')).toBe('3.41.9');
  });

  it('parses `Dart SDK version: 3.11.5 (stable) ...` ', () => {
    expect(parseDartVersion('Dart SDK version: 3.11.5 (stable) (Wed ...) on "macos_arm64"'))
      .toBe('3.11.5');
  });

  it('parses leading-v node-style version strings', () => {
    expect(parseSemverLike('v22.10.0')).toBe('22.10.0');
    expect(parseSemverLike('10.0.0')).toBe('10.0.0');
    expect(parseSemverLike('1.2.5')).toBe('1.2.5');
  });

  it('returns null for unparseable input', () => {
    expect(parseSemverLike('garbage')).toBeNull();
    expect(parseFlutterVersion('not flutter')).toBeNull();
  });
});

describe('doctor: evaluateChecks', () => {
  it('passes when every required tool meets the floor version', async () => {
    const probe: Probe = async (tool) =>
      ({ ok: true, raw: '', version: REQUIREMENTS[tool].minimum }) as const;
    const r = await evaluateChecks(probe, () => Promise.resolve(true));
    expect(r.ok).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it('flags an outdated tool and remediation message', async () => {
    const probe: Probe = async (tool) => {
      if (tool === 'node') return { ok: true, raw: 'v18.0.0', version: '18.0.0' };
      return { ok: true, raw: '', version: REQUIREMENTS[tool].minimum };
    };
    const r = await evaluateChecks(probe, () => Promise.resolve(true));
    expect(r.ok).toBe(false);
    const node = r.checks.find((c) => c.tool === 'node')!;
    expect(node.ok).toBe(false);
    expect(node.message).toMatch(/22/);
  });

  it('flags a missing tool', async () => {
    const probe: Probe = async () => ({ ok: false, raw: '', version: null });
    const r = await evaluateChecks(probe, () => Promise.resolve(true));
    expect(r.ok).toBe(false);
    const toolChecks = r.checks.filter((c) => c.tool !== 'flutter_app');
    expect(toolChecks.every((c) => !c.ok)).toBe(true);
    expect(toolChecks[0]!.message).toMatch(/install/i);
  });

  it('flags missing flutter_app/.dart_tool', async () => {
    const probe: Probe = async (tool) =>
      ({ ok: true, raw: '', version: REQUIREMENTS[tool].minimum }) as const;
    const r = await evaluateChecks(probe, () => Promise.resolve(false));
    expect(r.ok).toBe(false);
    const fa = r.checks.find((c) => c.tool === 'flutter_app');
    expect(fa?.ok).toBe(false);
    expect(fa?.message).toMatch(/flutter pub get/);
  });
});
