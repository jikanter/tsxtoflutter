import type { Length, NormalizedStyle } from '@tsxtoflutter/ir';

const SPACING: Record<string, number> = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
  '32': 128,
  '40': 160,
  '48': 192,
  '56': 224,
  '64': 256,
};

const RADIUS: Record<string, number> = {
  none: 0,
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
};

export function classesToStyle(classes: string): NormalizedStyle {
  const style: NormalizedStyle = {};
  if (!classes.trim()) return style;
  for (const cls of classes.split(/\s+/).filter(Boolean)) {
    applyClass(cls, style);
  }
  return style;
}

function px(v: number): Length {
  return { kind: 'px', value: v };
}

function applyClass(cls: string, style: NormalizedStyle): void {
  let m = cls.match(/^gap-(\S+)$/);
  if (m && SPACING[m[1]!] !== undefined) {
    style.layout = { ...style.layout, gap: px(SPACING[m[1]!]!) };
    return;
  }

  m = cls.match(/^h-(\S+)$/);
  if (m && SPACING[m[1]!] !== undefined) {
    style.box = { ...style.box, height: px(SPACING[m[1]!]!) };
    return;
  }

  m = cls.match(/^w-(\S+)$/);
  if (m && SPACING[m[1]!] !== undefined) {
    style.box = { ...style.box, width: px(SPACING[m[1]!]!) };
    return;
  }

  m = cls.match(/^px-(\S+)$/);
  if (m && SPACING[m[1]!] !== undefined) {
    style.box = {
      ...style.box,
      padding: { ...style.box?.padding, x: px(SPACING[m[1]!]!) },
    };
    return;
  }

  m = cls.match(/^py-(\S+)$/);
  if (m && SPACING[m[1]!] !== undefined) {
    style.box = {
      ...style.box,
      padding: { ...style.box?.padding, y: px(SPACING[m[1]!]!) },
    };
    return;
  }

  m = cls.match(/^p-(\S+)$/);
  if (m && SPACING[m[1]!] !== undefined) {
    style.box = {
      ...style.box,
      padding: {
        ...style.box?.padding,
        x: px(SPACING[m[1]!]!),
        y: px(SPACING[m[1]!]!),
      },
    };
    return;
  }

  if (cls === 'rounded') {
    style.box = { ...style.box, radius: { all: px(4) } };
    return;
  }
  m = cls.match(/^rounded-(\S+)$/);
  if (m && RADIUS[m[1]!] !== undefined) {
    style.box = { ...style.box, radius: { all: px(RADIUS[m[1]!]!) } };
    return;
  }

  m = cls.match(/^bg-(\S+)$/);
  if (m) {
    style.color = {
      ...style.color,
      bg: { kind: 'token', path: `color.${m[1]!}` },
    };
    return;
  }
  m = cls.match(/^text-(\S+)$/);
  if (m && SPACING[m[1]!] === undefined) {
    style.color = {
      ...style.color,
      fg: { kind: 'token', path: `color.${m[1]!}` },
    };
    return;
  }
}
