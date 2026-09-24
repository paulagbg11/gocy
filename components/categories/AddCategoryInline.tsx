"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { useCreateCategory } from "@/lib/queries/categories";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Category } from "@/lib/supabase/types";

/**
 * Botón "+" que despliega un mini-formulario para crear una categoría nueva
 * (emoji + nombre). Se dibuja como chip dentro de una fila de chips, o como
 * cuadro cuando acompaña a la cuadrícula del selector de categorías.
 */
export function AddCategoryInline({
  onCreated,
  as = "chip",
}: {
  onCreated?: (category: Category) => void;
  as?: "chip" | "tile";
}) {
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const createCategory = useCreateCategory();

  const reset = () => {
    setOpen(false);
    setEmoji("");
    setName("");
  };

  const save = async () => {
    if (!name.trim()) return;
    const category = await createCategory.mutateAsync({
      name: name.trim(),
      emoji: emoji.trim() || "📍",
    });
    onCreated?.(category);
    reset();
  };

  if (!open) {
    if (as === "tile") {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border-2 border-dashed border-border px-1.5 py-3 text-muted-foreground"
        >
          <Plus size={24} />
          <span className="text-center text-[12px] font-medium leading-tight">Nueva</span>
        </button>
      );
    }
    return (
      <Chip type="button" onClick={() => setOpen(true)}>
        <Plus size={14} /> Categoría
      </Chip>
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center gap-1.5 rounded-full border border-accent bg-surface px-2 py-1",
        // En la cuadrícula el formulario no cabe en una celda: ocupa la fila.
        as === "tile" && "col-span-3",
      )}
    >
      <Input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        placeholder="🙂"
        className="!w-11 h-8 px-1 text-center text-base shrink-0"
        maxLength={4}
      />
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="Nombre"
        className="!w-28 h-8 shrink-0"
      />
      <Button type="button" size="sm" onClick={save} disabled={createCategory.isPending || !name.trim()}>
        Crear
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={reset}>
        ✕
      </Button>
    </div>
  );
}
