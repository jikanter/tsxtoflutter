/**
 * DTCG (W3C Design Tokens Community Group) v1 loader.
 *
 * One `tokens.json` (`application/design-tokens+json`) drives:
 *   - Tailwind config emission (TS side)
 *   - Dart `theme.dart` constants emission (Dart codegen reads JSON output)
 *
 * Implementation: thin wrapper around Style Dictionary v4+.
 */

export interface DtcgToken {
  $value: string | number | Record<string, unknown>;
  $type?: string;
  $description?: string;
}

export interface DtcgGroup {
  [key: string]: DtcgToken | DtcgGroup;
}

export interface TailwindThemeOutput {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  fontFamily: Record<string, string[]>;
  fontSize: Record<string, [string, { lineHeight?: string }]>;
}

export interface DartThemeOutput {
  /** Path to write the generated `theme.dart` constants to. */
  filePath: string;
  /** Dart source text (consumers can write or further transform). */
  contents: string;
}

export async function loadDtcg(_filePath: string): Promise<DtcgGroup> {
  // TODO: implement; resolve $ref aliases per DTCG spec.
  throw new Error('not implemented');
}

export function emitTailwindTheme(_tokens: DtcgGroup): TailwindThemeOutput {
  // TODO: walk DTCG groups, map color/spacing/typography to Tailwind shape.
  throw new Error('not implemented');
}

export function emitDartTheme(_tokens: DtcgGroup, _filePath: string): DartThemeOutput {
  // TODO: emit a Dart file declaring `class AppTokens extends ThemeExtension<AppTokens>`.
  throw new Error('not implemented');
}
