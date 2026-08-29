import { forwardRef } from "react";
import clsx from "clsx";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 h-11 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 ease-out focus:border-accent",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        "w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 ease-out focus:border-accent resize-none",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx("text-sm font-medium text-muted-foreground mb-1.5 block", className)}
      {...props}
    />
  );
}
