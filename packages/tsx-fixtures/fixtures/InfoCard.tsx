export interface InfoCardProps {
  title: string;
  body: string;
}

export function InfoCard({ title, body }: InfoCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
