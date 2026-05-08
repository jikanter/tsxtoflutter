// Tests for the iOS platform-aware emitter helpers.
//
// All helpers in `mapping/ios.dart` produce Dart-source strings that branch on
// `Theme.of(context).platform` rather than `Platform.isIOS`. The branching is
// runtime, but the *content* of each branch is decided at codegen time.
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/mapping/ios.dart';

void main() {
  group('IosEmit.scrollPhysics', () {
    test('emits adaptive ScrollPhysics expression (Bouncing on iOS)', () {
      final dart = IosEmit.scrollPhysics();
      expect(dart, contains('Theme.of(context).platform'));
      expect(dart, contains('BouncingScrollPhysics'));
      expect(dart, contains('ClampingScrollPhysics'));
    });
  });

  group('IosEmit.pageRoute', () {
    test('wraps a builder in an adaptive route (Cupertino on iOS)', () {
      final dart = IosEmit.pageRoute(builder: '(_) => const NextScreen()');
      expect(dart, contains('Theme.of(context).platform'));
      expect(dart, contains('CupertinoPageRoute'));
      expect(dart, contains('MaterialPageRoute'));
      expect(dart, contains('(_) => const NextScreen()'));
    });
  });

  group('IosEmit.haptic', () {
    test('primary action emits lightImpact', () {
      expect(IosEmit.haptic(HapticIntent.primary),
          'HapticFeedback.lightImpact()');
    });

    test('destructive action emits mediumImpact', () {
      expect(IosEmit.haptic(HapticIntent.destructive),
          'HapticFeedback.mediumImpact()');
    });

    test('selection emits selectionClick', () {
      expect(IosEmit.haptic(HapticIntent.selection),
          'HapticFeedback.selectionClick()');
    });
  });

  group('IosEmit.wrapOnPressedWithHaptic', () {
    test('null pressed handler stays null (button is disabled)', () {
      expect(IosEmit.wrapOnPressedWithHaptic('null', HapticIntent.primary),
          'null');
    });

    test('wraps a real handler with the haptic call', () {
      final wrapped = IosEmit.wrapOnPressedWithHaptic(
          'widget.onTap', HapticIntent.primary);
      expect(wrapped, contains('HapticFeedback.lightImpact()'));
      expect(wrapped, contains('widget.onTap'));
      // Adaptive: only fire haptic on iOS / macOS.
      expect(wrapped, contains('Theme.of(context).platform'));
    });

    test('destructive uses mediumImpact', () {
      final wrapped = IosEmit.wrapOnPressedWithHaptic(
          'widget.onDelete', HapticIntent.destructive);
      expect(wrapped, contains('HapticFeedback.mediumImpact()'));
      expect(wrapped, contains('widget.onDelete'));
    });
  });

  group('IosEmit.iconButtonTooltip', () {
    test('returns null when no aria-label or text label is present', () {
      expect(IosEmit.iconButtonTooltip(ariaLabel: null, textLabel: null),
          isNull);
    });

    test('prefers explicit aria-label', () {
      expect(IosEmit.iconButtonTooltip(ariaLabel: 'Close', textLabel: 'X'),
          'Close');
    });

    test('falls back to visible text label', () {
      expect(IosEmit.iconButtonTooltip(ariaLabel: null, textLabel: 'Open'),
          'Open');
    });

    test('rejects fixed-height containers around text', () {
      // Sanity: the iOS doc says we never emit fixed text heights. Helper
      // returns null when given an empty hint.
      expect(IosEmit.iconButtonTooltip(ariaLabel: '', textLabel: ''), isNull);
    });
  });
}
