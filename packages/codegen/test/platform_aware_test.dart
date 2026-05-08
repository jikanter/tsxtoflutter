// Tests for the platform-aware screen-body wrapper emitter. Encodes the
// Day-1 platform invariants: SafeArea on every screen, IME-aware bottom
// padding when the body contains form input.
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/emitter/platform_aware.dart';

void main() {
  group('PlatformAwareEmit.wrapScreenBody', () {
    test('always wraps body in SafeArea (top + bottom)', () {
      final dart = PlatformAwareEmit.wrapScreenBody(
        body: 'const MyScreen()',
        hasFormInput: false,
      );
      expect(dart, contains('SafeArea'));
      expect(dart, contains('const MyScreen()'));
    });

    test('hasFormInput=true adds MediaQuery.viewInsetsOf padding', () {
      final dart = PlatformAwareEmit.wrapScreenBody(
        body: 'const MyForm()',
        hasFormInput: true,
      );
      expect(dart, contains('MediaQuery.viewInsetsOf(context).bottom'));
      expect(dart, contains('SafeArea'));
      expect(dart, contains('const MyForm()'));
    });

    test('hasFormInput=false omits the keyboard inset wrapper', () {
      final dart = PlatformAwareEmit.wrapScreenBody(
        body: 'const Static()',
        hasFormInput: false,
      );
      expect(dart, isNot(contains('MediaQuery.viewInsetsOf')));
    });

    test('never emits Platform.isIOS ternary in user-facing code', () {
      final dart = PlatformAwareEmit.wrapScreenBody(
        body: 'const X()',
        hasFormInput: true,
      );
      expect(dart, isNot(contains('Platform.isIOS')));
    });
  });

  group('PlatformAwareEmit.scaffold', () {
    test('default scaffold sets resizeToAvoidBottomInset: true', () {
      final dart = PlatformAwareEmit.scaffold(body: 'const Body()');
      expect(dart, contains('Scaffold('));
      expect(dart, contains('resizeToAvoidBottomInset: true'));
      expect(dart, contains('const Body()'));
    });

    test('passes through explicit appBar argument', () {
      final dart = PlatformAwareEmit.scaffold(
        body: 'const Body()',
        appBar: 'AppBar(title: const Text("Hi"))',
      );
      expect(dart, contains('appBar: AppBar(title: const Text("Hi"))'));
    });
  });
}
