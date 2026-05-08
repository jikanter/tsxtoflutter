import { Checkbox } from '@/components/ui/checkbox';

export interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}

export function CheckboxRow({ label, checked, onToggle }: CheckboxRowProps) {
  return (
    <label className="flex items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
