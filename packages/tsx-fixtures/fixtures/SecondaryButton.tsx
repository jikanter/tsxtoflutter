import { Button } from '@/components/ui/button';

export interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
}

export function SecondaryButton({ label, onPress }: SecondaryButtonProps) {
  return (
    <Button variant="outline" size="md" onClick={onPress}>
      {label}
    </Button>
  );
}
