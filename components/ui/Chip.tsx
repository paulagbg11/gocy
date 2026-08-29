import clsx from "clsx";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  color?: string;
}

export function Chip({ active, color, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out",
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border bg-surface text-foreground hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ background: active ? "currentColor" : color }}
        />
      )}
      {children}
    </button>
  );
}
