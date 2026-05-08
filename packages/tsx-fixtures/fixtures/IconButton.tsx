import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export interface IconButtonProps {
  onPress: () => void;
}

export function IconButton({ onPress }: IconButtonProps) {
  return (
    <Button variant="ghost" size="icon" onClick={onPress} aria-label="search">
      <Search className="h-4 w-4" />
    </Button>
  );
}
