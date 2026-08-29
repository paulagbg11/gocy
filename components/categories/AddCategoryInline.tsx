"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCreateCategory } from "@/lib/queries/categories";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Category } from "@/lib/supabase/types";

/** Chip "+" que despliega un mini-formulario para crear una categoría nueva (emoji + nombre). */
export function AddCategoryInline({ onCreated }: { onCreated?: (category: Category) => void }) {
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
    return (
      <Chip type="button" onClick={() => setOpen(true)}>
        <Plus size={14} /> Categoría
      </Chip>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-accent bg-surface px-2 py-1">
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
