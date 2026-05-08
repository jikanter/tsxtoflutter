import { Switch } from '@/components/ui/switch';

export interface SwitchRowProps {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}

export function SwitchRow({ label, checked, onToggle }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}
