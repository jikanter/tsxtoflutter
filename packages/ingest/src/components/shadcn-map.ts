import type { SemanticTag } from '@tsxtoflutter/ir';

export interface ShadcnEntry {
  tag: SemanticTag;
}

const TABLE: Record<string, ShadcnEntry> = {
  Button: { tag: 'button' },
};

export function lookupShadcn(name: string): ShadcnEntry | undefined {
  return TABLE[name];
}
