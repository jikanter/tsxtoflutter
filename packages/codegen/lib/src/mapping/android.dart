// Android-aware codegen helpers.
//
// These functions return Dart-source strings to be inlined into generated
// `*.g.dart` widget trees.
//
// Source rules: docs/research/03-android-platform.md §1.3 (predictive back) and
// §1.4 (foldables / breakpoints).

abstract final class AndroidEmit {
  /// Marker getter so tests can assert the helper is exported. Kept intentionally
  /// trivial — the real API is on the static methods below.
  static List<String> get values => const [
        'popScope',
        'layoutBuilderForBreakpoints',
      ];

  /// Wrap [child] in `PopScope` (NOT the deprecated `WillPopScope`). When
  /// [canPop] is `false`, [onPopInvoked] is required and is the Dart source of
  /// the callback (e.g. `'(didPop, result) => widget.onConfirm()'` or a simple
  /// `'widget.onConfirmExit'` reference).
  ///
  /// Required by Android 14+ predictive-back. WillPopScope silently breaks
  /// that gesture.
  static String popScope({
    required String child,
    required bool canPop,
    required String? onPopInvoked,
  }) {
    if (canPop && onPopInvoked == null) {
      return 'PopScope(canPop: true, child: $child)';
    }
    final cb = onPopInvoked ?? '(_, __) {}';
    // `onPopInvokedWithResult<T>` is the non-deprecated signature in Flutter
    // 3.22+. Using a typedef-free closure means we don't need to know T.
    final wrapped = cb.contains('=>') || cb.contains('(')
        ? cb
        : '(didPop, _) { if (!didPop) { ($cb)(); } }';
    return 'PopScope('
        'canPop: $canPop, '
        'onPopInvokedWithResult: $wrapped, '
        'child: $child'
        ')';
  }

  /// Build a `LayoutBuilder` that switches between four screen-size branches
  /// using Material adaptive-design breakpoints (compact < 600 dp, medium ≥
  /// 600 dp, expanded ≥ 840 dp, large ≥ 1200 dp).
  ///
  /// [baseBranch] is required; the others are optional. When all md/lg/xl
  /// branches are null this collapses to the base branch wrapped in a
  /// LayoutBuilder for parity with the responsive case.
  static String layoutBuilderForBreakpoints({
    required String baseBranch,
    String? mdBranch,
    String? lgBranch,
    String? xlBranch,
  }) {
    if (mdBranch == null && lgBranch == null && xlBranch == null) {
      return 'LayoutBuilder(builder: (context, constraints) => $baseBranch)';
    }
    // Built bottom-up so the largest matching branch wins.
    final body = StringBuffer('final w = constraints.maxWidth; ');
    if (xlBranch != null) {
      body.write('if (w >= 1200) return $xlBranch; ');
    }
    if (lgBranch != null) {
      body.write('if (w >= 840) return $lgBranch; ');
    }
    if (mdBranch != null) {
      body.write('if (w >= 600) return $mdBranch; ');
    }
    body.write('return $baseBranch;');

    return 'LayoutBuilder(builder: (context, constraints) { $body })';
  }
}
