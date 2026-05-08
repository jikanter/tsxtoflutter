import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export interface CtaProps {
  label: string;
  onGo: () => void;
}

export function Cta({ label, onGo }: CtaProps) {
  return (
    <Button variant="default" size="lg" className="gap-2" onClick={onGo}>
      {label}
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
