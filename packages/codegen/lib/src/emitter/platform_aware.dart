// Platform-aware screen-body wrappers.
//
// Every generated screen body MUST be wrapped in `SafeArea` (top + bottom)
// — see docs/research/04-ios-platform.md §2 (notch / Dynamic Island / home
// indicator) and §1.2 of the Android doc (edge-to-edge mandatory on
// Android 16). Forms additionally need `MediaQuery.viewInsetsOf(context)`
// padding so the IME doesn't cover focused inputs.
//
// All emitted code runs on Web, iOS, and Android. There are no platform
// ternaries here — `SafeArea` and `MediaQuery` work identically on all three.

abstract final class PlatformAwareEmit {
  /// Wrap the screen [body] (a Dart-source widget expression) in the
  /// platform-correct safe-area + IME-aware envelope.
  ///
  /// Set [hasFormInput] when the screen contains a `TextField` or other input
  /// widget — the wrapper adds bottom padding equal to
  /// `MediaQuery.viewInsetsOf(context).bottom` so the keyboard doesn't cover
  /// the focused field. For static screens, leave it false to avoid the
  /// extra `Padding` widget.
  static String wrapScreenBody({
    required String body,
    required bool hasFormInput,
  }) {
    if (!hasFormInput) {
      return 'SafeArea(child: $body)';
    }
    return 'SafeArea('
        'child: Padding('
        'padding: EdgeInsets.only('
        'bottom: MediaQuery.viewInsetsOf(context).bottom'
        '), '
        'child: $body'
        ')'
        ')';
  }

  /// Build a `Scaffold(...)` that wires up the platform-correct defaults:
  /// `resizeToAvoidBottomInset: true`, optional [appBar], and the [body]
  /// pre-wrapped via [wrapScreenBody].
  static String scaffold({
    required String body,
    String? appBar,
    bool hasFormInput = false,
  }) {
    final wrapped = wrapScreenBody(body: body, hasFormInput: hasFormInput);
    final args = <String>[
      'resizeToAvoidBottomInset: true',
      if (appBar != null) 'appBar: $appBar',
      'body: $wrapped',
    ];
    return 'Scaffold(${args.join(", ")})';
  }
}
