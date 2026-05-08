export * from './types.js';
export * from './tracer.js';
export * from './exporters.js';

/**
 * Span name constants. Centralised so the eval and trace tooling can match
 * them without string-search drift.
 */
export const SpanNames = {
  conversion: 'conversion',
  ingest: 'ingest',
  translate: 'translate',
  llmRequest: 'llm.request',
  toolRunFlutterAnalyze: 'tool.run_flutter_analyze',
  toolRenderWidgetScreenshot: 'tool.render_widget_screenshot',
  toolGetDesignToken: 'tool.get_design_token',
  toolLookupWidgetCatalog: 'tool.lookup_widget_catalog',
  codegen: 'codegen',
  cacheHit: 'cache.hit',
  cacheMiss: 'cache.miss',
} as const;
