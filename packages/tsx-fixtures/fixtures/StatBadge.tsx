export interface StatBadgeProps {
  label: string;
  value: number;
}

export function StatBadge({ label, value }: StatBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
