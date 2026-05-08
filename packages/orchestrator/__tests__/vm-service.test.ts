import { describe, expect, it } from 'vitest';
import { parseVmServiceUri, vmServiceWsUrl } from '../src/vm-service.js';

describe('parseVmServiceUri', () => {
  it('extracts the URI from a standard `flutter run` stdout line', () => {
    const line =
      'A Dart VM Service on Chrome is available at: http://127.0.0.1:54321/abc123XYZ=/';
    expect(parseVmServiceUri(line)).toBe('http://127.0.0.1:54321/abc123XYZ=/');
  });

  it('extracts from `Debug service listening on ws://...` form', () => {
    const line = 'Debug service listening on ws://127.0.0.1:5555/abc=/ws';
    expect(parseVmServiceUri(line)).toBe('ws://127.0.0.1:5555/abc=/ws');
  });

  it('returns null when no VM-service URI is present', () => {
    expect(parseVmServiceUri('boring log line')).toBeNull();
  });

  it('vmServiceWsUrl converts http VM-service URI to ws://...ws', () => {
    expect(vmServiceWsUrl('http://127.0.0.1:54321/abc=/'))
      .toBe('ws://127.0.0.1:54321/abc=/ws');
  });

  it('vmServiceWsUrl leaves a ws:// URL unchanged', () => {
    expect(vmServiceWsUrl('ws://127.0.0.1:5555/abc=/ws'))
      .toBe('ws://127.0.0.1:5555/abc=/ws');
  });
});
