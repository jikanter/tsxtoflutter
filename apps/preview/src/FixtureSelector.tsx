import type { FixtureEntry } from '@tsxtoflutter/tsx-fixtures';

interface Props {
  fixtures: readonly FixtureEntry[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function FixtureSelector({ fixtures, selectedId, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Fixture:</span>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {fixtures.map((f) => (
          <option key={f.id} value={f.id}>
            {f.id}
          </option>
        ))}
      </select>
    </label>
  );
}
