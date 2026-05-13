export function Checkmark({
  checked,
  size,
}: {
  checked: boolean;
  size: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span>Status:</span>
      {checked && (
        <svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
        >
          <path d="M2 6l3 3 5-6" />
        </svg>
      )}
    </div>
  );
}
