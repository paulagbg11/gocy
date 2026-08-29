import { forwardRef } from "react";
import clsx from "clsx";

/**
 * Versión "datetime-local" de DateField: una única caja (mismo ancho que
 * cualquier otro campo del formulario) en vez de partir fecha y hora en dos
 * cajas separadas. Usa el mismo truco de posicionamiento absoluto para que
 * el ancho lo decida el contenedor, no el widget nativo.
 */
export const DateTimeField = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative h-11 w-full">
      <input
        ref={ref}
        type="datetime-local"
        className={clsx(
          "absolute inset-0 h-full w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 ease-out focus:border-accent",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
DateTimeField.displayName = "DateTimeField";
