import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseKey,
  xlateKey,
  buildKey,
  CacheStore,
  collectStats,
  clearCache,
  gcCache,
} from '../src/cache/store.js';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsxf-cache-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('cache key derivation', () => {
  it('parseKey is sha256 of (source + parser version)', () => {
    const a = parseKey({ source: 'export const x = 1', parserVersion: '0.1.0' });
    const b = parseKey({ source: 'export const x = 1', parserVersion: '0.1.0' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('parseKey changes when parser version bumps', () => {
    const a = parseKey({ source: 'x', parserVersion: '0.1.0' });
    const b = parseKey({ source: 'x', parserVersion: '0.2.0' });
    expect(a).not.toBe(b);
  });

  it('xlateKey includes model-id and ruleset-version even with no LLM', () => {
    const subtree = JSON.stringify({ tag: 'button' });
    const a = xlateKey({ subtreeJson: subtree, rulesetVersion: '1.0', modelId: 'none' });
    const b = xlateKey({ subtreeJson: subtree, rulesetVersion: '1.1', modelId: 'none' });
    const c = xlateKey({ subtreeJson: subtree, rulesetVersion: '1.0', modelId: 'sonnet' });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('buildKey hashes Dart sources + pubspec contents', () => {
    const a = buildKey({ dartSources: ['a.dart contents'], pubspec: 'name: x' });
    const b = buildKey({ dartSources: ['a.dart contents'], pubspec: 'name: x' });
    expect(a).toBe(b);
    const c = buildKey({ dartSources: ['a.dart different'], pubspec: 'name: x' });
    expect(c).not.toBe(a);
  });
});

describe('CacheStore round-trip', () => {
  it('writes and reads a parse-cache entry', async () => {
    const store = new CacheStore(dir);
    const key = parseKey({ source: 's', parserVersion: '0.1.0' });
    await store.put('parse', key, { ir: { tag: 'root' } });
    const got = await store.get('parse', key);
    expect(got).toEqual({ ir: { tag: 'root' } });
  });

  it('returns null on miss', async () => {
    const store = new CacheStore(dir);
    expect(await store.get('parse', 'nonexistent'.padEnd(64, '0'))).toBeNull();
  });

  it('separates tiers in their own subdirectories', async () => {
    const store = new CacheStore(dir);
    const k = '0'.repeat(64);
    await store.put('parse', k, { x: 1 });
    await store.put('xlate', k, { y: 2 });
    await store.put('build', k, { z: 3 });
    expect(await store.get('parse', k)).toEqual({ x: 1 });
    expect(await store.get('xlate', k)).toEqual({ y: 2 });
    expect(await store.get('build', k)).toEqual({ z: 3 });
  });
});

describe('cache stats / clear / gc', () => {
  it('collectStats counts entries and bytes per tier', async () => {
    const store = new CacheStore(dir);
    await store.put('parse', '0'.repeat(64), { a: 1 });
    await store.put('parse', '1'.repeat(64), { a: 2 });
    await store.put('xlate', '2'.repeat(64), { a: 3 });
    const stats = await collectStats(dir);
    expect(stats.parse.entries).toBe(2);
    expect(stats.xlate.entries).toBe(1);
    expect(stats.build.entries).toBe(0);
    expect(stats.parse.bytes).toBeGreaterThan(0);
  });

  it('clearCache removes all entries across tiers', async () => {
    const store = new CacheStore(dir);
    await store.put('parse', '0'.repeat(64), { a: 1 });
    await store.put('xlate', '1'.repeat(64), { a: 2 });
    await clearCache(dir);
    const stats = await collectStats(dir);
    expect(stats.parse.entries).toBe(0);
    expect(stats.xlate.entries).toBe(0);
  });

  it('gcCache deletes entries older than maxAge but keeps recent ones', async () => {
    const store = new CacheStore(dir);
    const oldKey = '0'.repeat(64);
    const newKey = '1'.repeat(64);
    await store.put('parse', oldKey, { stale: true });
    await store.put('parse', newKey, { fresh: true });
    const oldFile = path.join(dir, 'parse', `${oldKey}.json`);
    const longAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFile, longAgo, longAgo);
    const removed = await gcCache(dir, { maxAgeDays: 30 });
    expect(removed).toBe(1);
    expect(await store.get('parse', oldKey)).toBeNull();
    expect(await store.get('parse', newKey)).toEqual({ fresh: true });
  });
});
