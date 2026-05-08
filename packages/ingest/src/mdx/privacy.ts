// MDX frontmatter `permissions:` block → Info.plist privacy strings.
//
// Phase 4 R4. Missing privacy strings (NSCameraUsageDescription etc.) is
// the top App Store rejection cause; this module turns the MDX-side
// declaration into the plist XML the iOS Runner needs and surfaces hard
// errors when the declaration is malformed.
//
// This module is **standalone**: it doesn't run the MDX parser, just consumes
// an already-parsed `permissions` object. The caller (MDX visitor, Phase 5+)
// supplies that object.
//
// Example MDX:
//
//   ---
//   permissions:
//     camera: "Take a photo of your meal"
//     locationWhenInUse: "Suggest restaurants nearby"
//   ---
//
//   # My screen
//   <Camera />
//
// → ingestor calls `emitInfoPlistPrivacyStrings(frontmatter.permissions)`,
//   splices the returned `xml` into `flutter_app/ios/Runner/Info.plist`.

import type { IRDiagnostic } from '@tsxtoflutter/ir';

/**
 * Map from MDX-frontmatter permission keys to the corresponding
 * `NS*UsageDescription` Info.plist key. Adding a new permission is a one-line
 * change here; the emitter handles the rest.
 */
export const PRIVACY_KEY_BY_PERMISSION = {
  camera: 'NSCameraUsageDescription',
  microphone: 'NSMicrophoneUsageDescription',
  photoLibrary: 'NSPhotoLibraryUsageDescription',
  photoLibraryAdd: 'NSPhotoLibraryAddUsageDescription',
  locationWhenInUse: 'NSLocationWhenInUseUsageDescription',
  locationAlways: 'NSLocationAlwaysAndWhenInUseUsageDescription',
  contacts: 'NSContactsUsageDescription',
  calendars: 'NSCalendarsUsageDescription',
  reminders: 'NSRemindersUsageDescription',
  bluetooth: 'NSBluetoothAlwaysUsageDescription',
  faceID: 'NSFaceIDUsageDescription',
  motion: 'NSMotionUsageDescription',
  speechRecognition: 'NSSpeechRecognitionUsageDescription',
  appleMusic: 'NSAppleMusicUsageDescription',
  homeKit: 'NSHomeKitUsageDescription',
  health: 'NSHealthShareUsageDescription',
  healthUpdate: 'NSHealthUpdateUsageDescription',
  localNetwork: 'NSLocalNetworkUsageDescription',
  userTracking: 'NSUserTrackingUsageDescription',
} as const;

export type PermissionKey = keyof typeof PRIVACY_KEY_BY_PERMISSION;

export interface PrivacyEmitResult {
  /** Plist XML fragment — empty string when no permissions were declared. */
  xml: string;
  /** Warnings for unknown keys; errors for empty reasons. */
  diagnostics: IRDiagnostic[];
}

/**
 * Emit the `<key>NS*UsageDescription</key><string>…</string>` pairs for the
 * given permissions block. The output is a flat sequence of plist key/string
 * pairs (no enclosing `<dict>` / `<plist>`) so the caller can splice it into
 * an existing Info.plist's top-level dict.
 *
 * Diagnostics:
 *   - `privacy-unknown-key`  (warn)  — key not in [PRIVACY_KEY_BY_PERMISSION]
 *   - `privacy-empty-reason` (error) — reason was empty / whitespace-only
 *
 * Iteration follows the input object's insertion order so output is
 * byte-deterministic across runs.
 */
export function emitInfoPlistPrivacyStrings(
  permissions: Record<string, string> | null | undefined,
): PrivacyEmitResult {
  if (!permissions) {
    return { xml: '', diagnostics: [] };
  }

  const lines: string[] = [];
  const diagnostics: IRDiagnostic[] = [];

  for (const [key, reason] of Object.entries(permissions)) {
    if (!(key in PRIVACY_KEY_BY_PERMISSION)) {
      diagnostics.push({
        severity: 'warn',
        code: 'privacy-unknown-key',
        message:
          `Unknown permission '${key}' in MDX frontmatter; ` +
          `add a mapping to PRIVACY_KEY_BY_PERMISSION or remove it.`,
      });
      continue;
    }
    if (reason == null || reason.trim() === '') {
      diagnostics.push({
        severity: 'error',
        code: 'privacy-empty-reason',
        message:
          `Permission '${key}' was declared with an empty reason. ` +
          `Apple rejects apps that ship NS*UsageDescription with a blank ` +
          `string — provide a user-facing reason in the MDX frontmatter.`,
      });
      continue;
    }
    const plistKey =
      PRIVACY_KEY_BY_PERMISSION[key as PermissionKey];
    lines.push(`\t<key>${plistKey}</key>`);
    lines.push(`\t<string>${escapeXml(reason)}</string>`);
  }

  return { xml: lines.join('\n'), diagnostics };
}

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
