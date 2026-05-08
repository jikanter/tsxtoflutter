export * from './pricing.js';
export * from './budget.js';
export * from './complexity.js';
export * from './client.js';
export * from './system-prompt.js';
export * from './tool-loop.js';

export { runFlutterAnalyze, parseAnalyzerOutput } from './tools/run-flutter-analyze.js';
export type {
  AnalyzeResult,
  AnalyzerDiagnostic,
  AnalyzeOptions,
} from './tools/run-flutter-analyze.js';

export { renderWidgetScreenshot } from './tools/render-widget-screenshot.js';
export type {
  ScreenshotResult,
  ScreenshotOptions,
} from './tools/render-widget-screenshot.js';

export { getDesignToken } from './tools/get-design-token.js';
export type {
  ResolvedToken,
  GetDesignTokenOptions,
} from './tools/get-design-token.js';

export { lookupWidgetCatalog } from './tools/lookup-widget-catalog.js';
export type { CatalogHit } from './tools/lookup-widget-catalog.js';

/** Three-tier model routing. Sonnet hot path; Opus + Haiku scaffolded behind flags. */
export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
  haiku: 'claude-haiku-4-5-20251001',
} as const;
export type ModelId = (typeof MODELS)[keyof typeof MODELS];
