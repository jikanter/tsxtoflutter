/**
 * Minimal shadcn-flavored `Button` stub for the preview app.
 *
 * The codegen does not reach into shadcn's source — the ingest layer maps
 * `<Button variant="default" size="lg">` semantically. The preview, however,
 * needs *something* to render in React; this stub mimics shadcn's API
 * surface (variants + sizes + asChild forwarding) closely enough that the
 * fixture corpus renders correctly without pulling shadcn into the workspace.
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'link';
type Size = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const baseClasses =
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className = '', ...rest }, ref) => {
    const cls = [baseClasses, variantClasses[variant], sizeClasses[size], className]
      .filter(Boolean)
      .join(' ');
    return <button ref={ref} className={cls} {...rest} />;
  },
);
Button.displayName = 'Button';
