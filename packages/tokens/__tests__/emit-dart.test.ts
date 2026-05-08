import { describe, expect, it } from 'vitest';
import { emitDartTheme } from '../src/emit-dart.js';

describe('emitDartTheme', () => {
  it('emits a Dart file with M3 color constants from the token tree', () => {
    const tokens = {
      color: {
        primary: { $type: 'color', $value: '#3366ff' },
        onPrimary: { $type: 'color', $value: '#ffffff' },
        surface: { $type: 'color', $value: '#fafafa' },
      },
    };
    const out = emitDartTheme(tokens, 'flutter_app/lib/theme.g.dart');
    expect(out.filePath).toBe('flutter_app/lib/theme.g.dart');
    expect(out.contents).toContain('// GENERATED CODE - DO NOT MODIFY BY HAND');
    expect(out.contents).toContain("import 'package:flutter/material.dart';");
    expect(out.contents).toContain('class GeneratedTokens');
    expect(out.contents).toMatch(/Color primary = Color\(0xFF3366FF\)/);
    expect(out.contents).toMatch(/Color onPrimary = Color\(0xFFFFFFFF\)/);
    expect(out.contents).toMatch(/Color surface = Color\(0xFFFAFAFA\)/);
  });

  it('expands #rgb shorthand to full hex', () => {
    const tokens = {
      color: { red: { $type: 'color', $value: '#f00' } },
    };
    const out = emitDartTheme(tokens, 'theme.g.dart');
    expect(out.contents).toMatch(/Color red = Color\(0xFFFF0000\)/);
  });

  it('emits dimension constants as doubles', () => {
    const tokens = {
      spacing: { '4': { $type: 'dimension', $value: '16px' } },
    };
    const out = emitDartTheme(tokens, 'theme.g.dart');
    expect(out.contents).toMatch(/double s4 = 16\.0/);
  });

  it('flattens nested color groups with snake_case', () => {
    const tokens = {
      color: {
        brand: {
          500: { $type: 'color', $value: '#112233' },
        },
      },
    };
    const out = emitDartTheme(tokens, 'theme.g.dart');
    expect(out.contents).toMatch(/Color brand_500 = Color\(0xFF112233\)/);
  });
});
