/**
 * Catalog of canonical TSX fixtures the codegen must handle.
 * Add new fixtures by dropping a file in `fixtures/` and registering it here.
 *
 * The CI quality gate runs the codegen against every entry below and
 * asserts the generated Dart compiles, formats clean, and matches its
 * golden snapshot.
 */

export interface FixtureEntry {
  /** Stable ID for cache keys and golden filenames. */
  id: string;
  /** Path relative to this package, used by ingest harness. */
  path: string;
  /** Brief description of what this fixture exercises. */
  exercises: string;
}

export const FIXTURES: readonly FixtureEntry[] = [
  {
    id: 'button-primary',
    path: 'fixtures/Button.tsx',
    exercises: 'shadcn Button, Tailwind utility classes, lucide icon, onClick handler',
  },
  // TODO: add Card, Dialog, Input, Tabs, List, Avatar, Badge,
  //       responsive layout, dark-mode variants, MDX prose mix, etc.
] as const;
