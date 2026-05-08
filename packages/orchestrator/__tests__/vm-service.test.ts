import { describe, expect, test } from 'vitest';

import { extractVmServiceUri } from '../src/vm-service.js';

describe('extractVmServiceUri', () => {
  test('finds the URI in a Flutter run banner', () => {
    const stdout = [
      'Launching lib/main.dart on Chrome in debug mode...',
      'Waiting for connection from debug service on Chrome...',
      'Debug service listening on ws://127.0.0.1:55432/aBc123XyZ=/ws',
      'Flutter run key commands.',
    ].join('\n');
    expect(extractVmServiceUri(stdout)).toBe(
      'ws://127.0.0.1:55432/aBc123XyZ=/ws',
    );
  });

  test('returns undefined when the banner has not appeared yet', () => {
    expect(extractVmServiceUri('Launching ...')).toBeUndefined();
  });

  test('matches the most recent URI when several are emitted', () => {
    const stdout = [
      'Debug service listening on ws://127.0.0.1:1111/old=/ws',
      'Lost connection.',
      'Debug service listening on ws://127.0.0.1:2222/new=/ws',
    ].join('\n');
    expect(extractVmServiceUri(stdout)).toBe(
      'ws://127.0.0.1:2222/new=/ws',
    );
  });
});
