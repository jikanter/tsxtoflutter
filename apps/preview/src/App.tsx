import { Suspense, lazy, useMemo, useState, type ComponentType } from 'react';

import { FIXTURES, type FixtureEntry } from '@tsxtoflutter/tsx-fixtures';

import { FixtureSelector } from './FixtureSelector.js';
import { propsFor } from './fixture-props.js';

// Eagerly glob the fixture sources so Vite resolves them through the
// dev server (with HMR) rather than at runtime. Each module is expected
// to export at least one React component as a named export.
const fixtureModules = import.meta.glob<Record<string, unknown>>(
  '../../../packages/tsx-fixtures/fixtures/*.tsx',
);

interface ResolvedFixture {
  entry: FixtureEntry;
  Component: ComponentType<Record<string, unknown>>;
}

function modulePathForFixture(entry: FixtureEntry): string {
  // FIXTURES paths are relative to the tsx-fixtures package root; convert to
  // the import.meta.glob key shape.
  return `../../../packages/tsx-fixtures/${entry.path}`;
}

function pickComponent(mod: Record<string, unknown>): ComponentType<Record<string, unknown>> | null {
  const def = mod['default'];
  if (typeof def === 'function') return def as ComponentType<Record<string, unknown>>;
  for (const key of Object.keys(mod)) {
    const value = mod[key];
    if (typeof value === 'function') return value as ComponentType<Record<string, unknown>>;
  }
  return null;
}

function loadFixture(entry: FixtureEntry): Promise<ResolvedFixture> {
  const key = modulePathForFixture(entry);
  const loader = fixtureModules[key];
  if (!loader) {
    return Promise.reject(
      new Error(`Fixture loader missing for ${entry.path} — check import.meta.glob pattern.`),
    );
  }
  return loader().then((mod) => {
    const Component = pickComponent(mod);
    if (!Component) throw new Error(`Fixture ${entry.id} exports no React component`);
    return { entry, Component };
  });
}

function FixtureView({ entry }: { entry: FixtureEntry }) {
  const Lazy = useMemo(
    () =>
      lazy(async () => {
        const { Component } = await loadFixture(entry);
        return { default: Component };
      }),
    [entry],
  );
  const props = propsFor(entry.id);
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading fixture…</p>}>
      <Lazy {...props} />
    </Suspense>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState<string>(FIXTURES[0]?.id ?? '');
  const entry = FIXTURES.find((f) => f.id === selectedId);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-base font-semibold">tsxtoflutter preview</h1>
        <FixtureSelector
          fixtures={FIXTURES}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
      </header>
      <div className="grid grid-cols-2 divide-x">
        <section className="overflow-auto p-6">
          <h2 className="mb-4 text-lg font-semibold">TSX (live React)</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {entry?.exercises ?? 'Select a fixture above.'}
          </p>
          <div className="rounded-lg border bg-card p-6">
            {entry ? <FixtureView entry={entry} /> : null}
          </div>
        </section>
        <section className="overflow-auto p-6">
          <h2 className="mb-4 text-lg font-semibold">Flutter Web</h2>
          <iframe
            title="flutter-preview"
            className="h-full w-full rounded-lg border bg-card"
            src="http://localhost:8080/"
          />
        </section>
      </div>
    </div>
  );
}
