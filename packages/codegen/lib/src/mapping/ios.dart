// iOS-aware codegen helpers.
//
// These functions return Dart-source strings to be inlined into generated
// `*.g.dart` widget trees. None of them branch on `Platform.isIOS` at runtime —
// the adaptive switch is always against `Theme.of(context).platform` so that
// a Material-themed iPad-in-Cupertino-mode app behaves as the user expects.
//
// Source rules: docs/research/04-ios-platform.md §6.

/// Why a button gets a haptic. `primary` = confirm / submit; `destructive` =
/// delete / discard; `selection` = list-item tap, segment-control nudge, etc.
enum HapticIntent { primary, destructive, selection }

abstract final class IosEmit {
  /// Adaptive `ScrollPhysics` selector. On iOS / macOS we want
  /// `BouncingScrollPhysics`; everywhere else `ClampingScrollPhysics` matches
  /// platform expectations.
  static String scrollPhysics() {
    return '(Theme.of(context).platform == TargetPlatform.iOS '
        '|| Theme.of(context).platform == TargetPlatform.macOS) '
        '? const BouncingScrollPhysics() '
        ': const ClampingScrollPhysics()';
  }

  /// Adaptive page-route constructor. iOS / macOS get `CupertinoPageRoute`
  /// (preserves swipe-back); other platforms keep `MaterialPageRoute` so the
  /// transition matches Android's predictive back animation.
  ///
  /// [builder] is the Dart source of a `WidgetBuilder` expression, e.g.
  /// `'(_) => const Detail()'`.
  static String pageRoute({required String builder}) {
    return '(Theme.of(context).platform == TargetPlatform.iOS '
        '|| Theme.of(context).platform == TargetPlatform.macOS) '
        '? CupertinoPageRoute(builder: $builder) '
        ': MaterialPageRoute(builder: $builder)';
  }

  /// Bare `HapticFeedback` call for the given intent. Web has no haptic API;
  /// the call is a no-op there but harmless.
  static String haptic(HapticIntent intent) {
    return switch (intent) {
      HapticIntent.primary => 'HapticFeedback.lightImpact()',
      HapticIntent.destructive => 'HapticFeedback.mediumImpact()',
      HapticIntent.selection => 'HapticFeedback.selectionClick()',
    };
  }

  /// Wrap an `onPressed` handler so it fires a haptic *before* the user
  /// callback, but only on iOS / macOS where haptics are first-class.
  ///
  /// [handler] is either `'null'` (disabled button) or a Dart expression that
  /// resolves to a `VoidCallback`. We return a closure literal in the latter
  /// case; the former passes through unchanged.
  static String wrapOnPressedWithHaptic(String handler, HapticIntent intent) {
    if (handler == 'null') return 'null';
    final hapticCall = haptic(intent);
    return '() { '
        'if (Theme.of(context).platform == TargetPlatform.iOS '
        '|| Theme.of(context).platform == TargetPlatform.macOS) '
        '{ $hapticCall; } '
        '($handler)(); '
        '}';
  }

  /// Pick the best tooltip string for an icon-only button. VoiceOver reads
  /// the tooltip as the label, so missing this is an accessibility regression
  /// on iOS specifically. Returns `null` when no label is available — caller
  /// should surface that as a codegen warning.
  static String? iconButtonTooltip({
    required String? ariaLabel,
    required String? textLabel,
  }) {
    if (ariaLabel != null && ariaLabel.isNotEmpty) return ariaLabel;
    if (textLabel != null && textLabel.isNotEmpty) return textLabel;
    return null;
  }
}
