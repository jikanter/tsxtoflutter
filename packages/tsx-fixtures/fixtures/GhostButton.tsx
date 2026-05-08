import { Button } from '@/components/ui/button';

export interface GhostButtonProps {
  label: string;
  onPress: () => void;
}

export function GhostButton({ label, onPress }: GhostButtonProps) {
  return (
    <Button variant="ghost" size="md" onClick={onPress}>
      {label}
    </Button>
  );
}
