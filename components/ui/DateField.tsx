import { forwardRef } from "react";
import clsx from "clsx";

/**
 * <input type="date"> normal (incluso con width:100%/min-width:0) puede
 * seguir desbordando en iOS Safari: el control nativo tiene su propio ancho
 * mínimo interno que ignora el CSS del elemento. Posicionándolo en
 * absolute con inset-0 dentro de un contenedor normal, el tamaño del campo
 * lo decide el contenedor (no el contenido del widget), lo cual sí es
 * imposible de saltarse — es el truco estándar para forzar el ancho de
 * controles nativos "tercos".
 */
interface DateFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Clases para el contenedor (p.ej. `flex-1` cuando va en una fila junto a otro campo). */
  wrapperClassName?: string;
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ className, wrapperClassName, ...props }, ref) => (
    <div className={clsx("relative h-11 w-full", wrapperClassName)}>
      <input
        ref={ref}
        type="date"
        className={clsx(
          "absolute inset-0 h-full w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 ease-out focus:border-accent",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
DateField.displayName = "DateField";
