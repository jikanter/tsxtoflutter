/**
 * Sample props per fixture for the live React preview pane.
 *
 * Fixtures declare typed props (e.g. `Cta` requires `label` + `onGo`) but
 * the preview needs concrete values to render. Keep a small registry here
 * keyed by fixture id; new fixtures get a default no-op set.
 */

export type FixtureProps = Record<string, unknown>;

export const FIXTURE_PROPS: Record<string, FixtureProps> = {
  'button-primary': {
    label: 'Get started',
    onGo: () => console.log('Cta.onGo'),
  },
};

export function propsFor(id: string): FixtureProps {
  return FIXTURE_PROPS[id] ?? {};
}
