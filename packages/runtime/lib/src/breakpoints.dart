import 'package:flutter/widgets.dart';

/// Tailwind v4 breakpoints, mirrored.
abstract final class Breakpoints {
  static const double sm = 640;
  static const double md = 768;
  static const double lg = 1024;
  static const double xl = 1280;
  static const double xl2 = 1536;
}

extension ResponsiveContext on BuildContext {
  double get _w => MediaQuery.sizeOf(this).width;
  bool get isSm => _w >= Breakpoints.sm;
  bool get isMd => _w >= Breakpoints.md;
  bool get isLg => _w >= Breakpoints.lg;
  bool get isXl => _w >= Breakpoints.xl;
  bool get isXl2 => _w >= Breakpoints.xl2;
}
