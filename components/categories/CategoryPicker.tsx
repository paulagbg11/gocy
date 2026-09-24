"use client";

import clsx from "clsx";
import { AddCategoryInline } from "./AddCategoryInline";
import type { Category } from "@/lib/supabase/types";

/**
 * Selector de categoría en cuadrícula.
 *
 * Antes eran chips pequeños puestos en fila: al elegir con el pulgar se
 * fallaba y se marcaba la de al lado. Aquí cada categoría es un cuadro grande
 * con el emoji en grande, así el objetivo es mucho mayor que el dedo y de un
 * vistazo se distinguen por dibujo, no por leer el texto.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {categories.map((category) => {
        const selected = value === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            aria-pressed={selected}
            className={clsx(
              "flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border-2 px-1.5 py-3 transition-colors duration-150 ease-out",
              selected ? "border-accent" : "border-transparent bg-surface-2",
            )}
            style={
              selected
                ? { background: `color-mix(in oklab, ${category.color} 20%, var(--surface))` }
                : undefined
            }
          >
            <span className="text-[26px] leading-none">{category.emoji}</span>
            <span
              className={clsx(
                "text-center text-[12px] leading-tight text-balance",
                selected ? "font-semibold" : "font-medium",
              )}
            >
              {category.name}
            </span>
          </button>
        );
      })}

      <AddCategoryInline as="tile" onCreated={(category) => onChange(category.id)} />
    </div>
  );
}
