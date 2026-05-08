import { Button } from '@/components/ui/button';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
}

export function PrimaryButton({ label, onPress }: PrimaryButtonProps) {
  return (
    <Button variant="default" size="md" onClick={onPress}>
      {label}
    </Button>
  );
}
