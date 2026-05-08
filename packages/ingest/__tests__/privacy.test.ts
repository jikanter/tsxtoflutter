// Tests for the MDX-frontmatter → Info.plist privacy-string emitter.
//
// Phase 4 R4: missing required privacy strings is the #1 App Store rejection.
// The emitter takes a `permissions:` block and produces (a) plist XML with the
// NS*UsageDescription entries and (b) diagnostics describing what's missing.
import { describe, expect, it } from 'vitest';

import {
  emitInfoPlistPrivacyStrings,
  PRIVACY_KEY_BY_PERMISSION,
} from '../src/mdx/privacy.js';

describe('emitInfoPlistPrivacyStrings', () => {
  it('emits empty xml + no diagnostics when permissions is empty', () => {
    const result = emitInfoPlistPrivacyStrings({});
    expect(result.xml).toBe('');
    expect(result.diagnostics).toEqual([]);
  });

  it('emits a single key/string pair for camera', () => {
    const result = emitInfoPlistPrivacyStrings({
      camera: 'Take a photo of your meal',
    });
    expect(result.xml).toContain('<key>NSCameraUsageDescription</key>');
    expect(result.xml).toContain('<string>Take a photo of your meal</string>');
    expect(result.diagnostics).toEqual([]);
  });

  it('handles every supported permission key', () => {
    const permissions = Object.fromEntries(
      Object.keys(PRIVACY_KEY_BY_PERMISSION).map((k) => [k, `${k} reason`]),
    );
    const result = emitInfoPlistPrivacyStrings(permissions);
    for (const plistKey of Object.values(PRIVACY_KEY_BY_PERMISSION)) {
      expect(result.xml).toContain(`<key>${plistKey}</key>`);
    }
    expect(result.diagnostics).toEqual([]);
  });

  it('escapes XML special characters in the description', () => {
    const result = emitInfoPlistPrivacyStrings({
      camera: 'Take a "photo" of <food> & save it',
    });
    expect(result.xml).toContain(
      '<string>Take a &quot;photo&quot; of &lt;food&gt; &amp; save it</string>',
    );
  });

  it('emits a hard-error diagnostic when a permission is declared with an empty reason', () => {
    const result = emitInfoPlistPrivacyStrings({ camera: '' });
    expect(result.xml).toBe('');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'error',
      code: 'privacy-empty-reason',
    });
    expect(result.diagnostics[0].message).toContain('camera');
  });

  it('emits a diagnostic + skips unknown permission keys', () => {
    const result = emitInfoPlistPrivacyStrings({
      camera: 'OK',
      'unknown-perm': 'should be skipped',
    } as Record<string, string>);
    expect(result.xml).toContain('NSCameraUsageDescription');
    expect(result.xml).not.toContain('unknown-perm');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'warn',
      code: 'privacy-unknown-key',
    });
  });

  it('preserves order of keys for deterministic output', () => {
    const a = emitInfoPlistPrivacyStrings({
      camera: 'A',
      microphone: 'B',
      locationWhenInUse: 'C',
    });
    const b = emitInfoPlistPrivacyStrings({
      camera: 'A',
      microphone: 'B',
      locationWhenInUse: 'C',
    });
    expect(a.xml).toBe(b.xml);
    // Iteration follows insertion order of the input object.
    const cameraIdx = a.xml.indexOf('NSCameraUsageDescription');
    const micIdx = a.xml.indexOf('NSMicrophoneUsageDescription');
    const locIdx = a.xml.indexOf('NSLocationWhenInUseUsageDescription');
    expect(cameraIdx).toBeLessThan(micIdx);
    expect(micIdx).toBeLessThan(locIdx);
  });

  it('treats null/undefined input as empty', () => {
    expect(emitInfoPlistPrivacyStrings(null).xml).toBe('');
    expect(emitInfoPlistPrivacyStrings(undefined).xml).toBe('');
  });
});
