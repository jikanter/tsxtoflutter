import { Input } from '@/components/ui/input';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
}

export function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
