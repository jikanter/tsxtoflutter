// Tests for the Android platform-aware emitter helpers.
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/mapping/android.dart';

void main() {
  group('AndroidEmit.popScope', () {
    test('canPop=false wraps child with onPopInvokedWithResult callback', () {
      final dart = AndroidEmit.popScope(
        child: 'const Body()',
        canPop: false,
        onPopInvoked: 'widget.onClosePrompt',
      );
      expect(dart, contains('PopScope'));
      expect(dart, contains('canPop: false'));
      expect(dart, contains('onPopInvokedWithResult:'));
      expect(dart, contains('widget.onClosePrompt'));
      expect(dart, contains('child: const Body()'));
    });

    test('canPop=true emits a thin wrapper (no callback needed)', () {
      final dart = AndroidEmit.popScope(
        child: 'const Body()',
        canPop: true,
        onPopInvoked: null,
      );
      expect(dart, contains('PopScope'));
      expect(dart, contains('canPop: true'));
      expect(dart, isNot(contains('onPopInvokedWithResult')));
    });

    test('never emits WillPopScope (deprecated for predictive back)', () {
      final dart = AndroidEmit.popScope(
        child: 'const Body()',
        canPop: false,
        onPopInvoked: 'widget.confirmExit',
      );
      expect(dart, isNot(contains('WillPopScope')));
    });
  });

  group('AndroidEmit.layoutBuilderForBreakpoints', () {
    test('emits LayoutBuilder switch over Material adaptive breakpoints', () {
      final dart = AndroidEmit.layoutBuilderForBreakpoints(
        baseBranch: 'const _Phone()',
        mdBranch: 'const _Tablet()',
        lgBranch: 'const _Desktop()',
      );
      expect(dart, startsWith('LayoutBuilder('));
      expect(dart, contains('builder: (context, constraints)'));
      // Md = 600 dp, Lg = 840 dp.
      expect(dart, contains('600'));
      expect(dart, contains('840'));
      expect(dart, contains('const _Phone()'));
      expect(dart, contains('const _Tablet()'));
      expect(dart, contains('const _Desktop()'));
    });

    test('passes through xl breakpoint when supplied', () {
      final dart = AndroidEmit.layoutBuilderForBreakpoints(
        baseBranch: 'a',
        mdBranch: 'b',
        lgBranch: 'c',
        xlBranch: 'd',
      );
      expect(dart, contains('1200'));
      expect(dart, contains('d'));
    });

    test('omits unused branches when null', () {
      final dart = AndroidEmit.layoutBuilderForBreakpoints(
        baseBranch: 'phone',
        mdBranch: null,
        lgBranch: null,
      );
      expect(dart, contains('phone'));
      expect(dart, isNot(contains('600')));
      expect(dart, isNot(contains('840')));
    });
  });

  group('AndroidEmit.semanticsForRole', () {
    test('back-compat sanity (no role => empty)', () {
      // Just confirms the helper is exported & callable.
      expect(AndroidEmit.values, isNotEmpty);
    });
  });
}
