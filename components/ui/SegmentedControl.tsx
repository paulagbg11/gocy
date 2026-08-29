import clsx from "clsx";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={clsx(
        "inline-flex rounded-[var(--radius-sm)] bg-surface-2 p-1 gap-1",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded-[calc(var(--radius-sm)-4px)] px-3.5 h-8 text-sm font-medium transition-colors duration-150 ease-out",
            opt.value === value
              ? "bg-surface text-foreground shadow-[var(--shadow-sm)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
