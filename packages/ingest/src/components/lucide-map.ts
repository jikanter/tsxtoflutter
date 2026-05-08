const TABLE: Record<string, string> = {
  ChevronRight: 'chevron_right',
};

export function lookupLucide(name: string): string | undefined {
  return TABLE[name];
}
