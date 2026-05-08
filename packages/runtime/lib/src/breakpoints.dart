import 'package:flutter/widgets.dart';

/// Tailwind v4 breakpoints, mirrored.
abstract final class Breakpoints {
  static const double sm = 640;
  static const double md = 768;
  static const double lg = 1024;
  static const double xl = 1280;
  static const double xl2 = 1536;
}

/// Material adaptive-design window-size classes (m3.material.io/foundations/layout/applying-layout/window-size-classes).
///
/// Used by codegen to emit `LayoutBuilder` switches when TSX uses Tailwind
/// responsive variants (`md:`, `lg:`, `xl:`). The thresholds intentionally
/// differ from [Breakpoints] above because Material's adaptive guidance is
/// dp-based and tuned for foldables / large-screen Android (≥ 270M devices).
abstract final class MaterialBreakpoints {
  /// Compact: phones in portrait. < 600 dp.
  static const double compact = 0;

  /// Medium: phones in landscape, small tablets. 600–839 dp.
  static const double medium = 600;

  /// Expanded: large tablets, foldables in dual-screen. 840–1199 dp.
  static const double expanded = 840;

  /// Large: laptops, desktops. 1200–1599 dp.
  static const double large = 1200;

  /// Extra-large: ultrawide / external displays. ≥ 1600 dp.
  static const double extraLarge = 1600;
}

/// Window-size class derived from a width measurement (dp).
enum WindowSizeClass { compact, medium, expanded, large, extraLarge }

WindowSizeClass windowSizeClassFor(double widthDp) {
  if (widthDp >= MaterialBreakpoints.extraLarge) return WindowSizeClass.extraLarge;
  if (widthDp >= MaterialBreakpoints.large) return WindowSizeClass.large;
  if (widthDp >= MaterialBreakpoints.expanded) return WindowSizeClass.expanded;
  if (widthDp >= MaterialBreakpoints.medium) return WindowSizeClass.medium;
  return WindowSizeClass.compact;
}

extension ResponsiveContext on BuildContext {
  double get _w => MediaQuery.sizeOf(this).width;
  bool get isSm => _w >= Breakpoints.sm;
  bool get isMd => _w >= Breakpoints.md;
  bool get isLg => _w >= Breakpoints.lg;
  bool get isXl => _w >= Breakpoints.xl;
  bool get isXl2 => _w >= Breakpoints.xl2;

  /// Material window-size class for the current MediaQuery width.
  WindowSizeClass get windowSizeClass => windowSizeClassFor(_w);

  /// Convenience: medium-or-wider — switch from `BottomNavigationBar` to
  /// `NavigationRail`, list/detail to two-pane, etc.
  bool get isMediumOrWider => _w >= MaterialBreakpoints.medium;
}
