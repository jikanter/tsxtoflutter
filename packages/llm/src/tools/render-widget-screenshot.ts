export interface ScreenshotResult {
  png_base64: string;
  width: number;
  height: number;
}

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  /** Headless renderer factory; tests inject a fake. */
  render?: (dartSource: string, w: number, h: number) => Promise<string>;
}

/**
 * Boot a headless Flutter Web instance and capture a PNG screenshot of the
 * rendered widget.
 *
 * Phase 3 ships the seam only — the headless renderer plugs in via the
 * `render` option. The default implementation throws so the model gets a
 * clear "renderer not configured" message instead of a silent black PNG.
 * The full integration lands in Phase 4 alongside the platform CI matrix.
 */
export async function renderWidgetScreenshot(
  dartSource: string,
  opts: ScreenshotOptions = {},
): Promise<ScreenshotResult> {
  const width = opts.width ?? 800;
  const height = opts.height ?? 600;
  if (!opts.render) {
    throw new Error(
      'renderWidgetScreenshot is not yet wired to a real headless Flutter Web instance. ' +
        'Pass `render` to use; otherwise the model should prefer run_flutter_analyze in Phase 3.',
    );
  }
  const png_base64 = await opts.render(dartSource, width, height);
  return { png_base64, width, height };
}
