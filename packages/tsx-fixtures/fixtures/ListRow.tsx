import { ChevronRight } from 'lucide-react';

export interface ListRowProps {
  title: string;
  subtitle: string;
  onPress: () => void;
}

export function ListRow({ title, subtitle, onPress }: ListRowProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex items-center justify-between gap-3 px-4 py-3 w-full"
    >
      <div className="flex flex-col gap-1 text-left">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
