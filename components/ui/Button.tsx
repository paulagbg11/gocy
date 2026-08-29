import { forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "bg-surface-2 text-foreground hover:brightness-95",
  ghost: "bg-transparent text-foreground hover:bg-surface-2",
  danger: "bg-transparent text-danger hover:bg-danger/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm h-8 px-3 gap-1.5",
  md: "text-sm h-11 px-4 gap-2",
  lg: "text-base h-13 px-5 gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-colors duration-150 ease-out disabled:opacity-40 disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
