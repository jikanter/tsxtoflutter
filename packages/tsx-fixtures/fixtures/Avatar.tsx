export interface AvatarProps {
  initials: string;
}

export function Avatar({ initials }: AvatarProps) {
  return (
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary">
      <span className="text-sm font-semibold text-primary-foreground">{initials}</span>
    </div>
  );
}
