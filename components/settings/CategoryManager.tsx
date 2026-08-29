"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import {
  useCategories,
  useTripHiddenCategories,
  useSetCategoryHidden,
  useUpdateCategory,
  useDeleteCategory,
} from "@/lib/queries/categories";
import { AddCategoryInline } from "@/components/categories/AddCategoryInline";
import { Input } from "@/components/ui/Input";
import type { Category } from "@/lib/supabase/types";

export function CategoryManager({ tripId }: { tripId: string }) {
  const { data: categories = [] } = useCategories();
  const { data: hidden = [] } = useTripHiddenCategories(tripId);
  const setHidden = useSetCategoryHidden();

  const hiddenIds = new Set(hidden.map((h) => h.category_id));

  return (
    <div className="flex flex-col gap-1.5">
      {categories.map((cat) => (
        <CategoryRow
          key={cat.id}
          category={cat}
          isHidden={hiddenIds.has(cat.id)}
          onToggleHidden={() =>
            setHidden.mutate({ tripId, categoryId: cat.id, hidden: !hiddenIds.has(cat.id) })
          }
        />
      ))}
      <div className="mt-1">
        <AddCategoryInline />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Ocultar una categoría la quita del mapa y de los filtros en este viaje (los lugares que ya
        tuviera no se borran).
      </p>
    </div>
  );
}

function CategoryRow({
  category,
  isHidden,
  onToggleHidden,
}: {
  category: Category;
  isHidden: boolean;
  onToggleHidden: () => void;
}) {
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [editingEmoji, setEditingEmoji] = useState(false);
  const [emoji, setEmoji] = useState(category.emoji);

  const saveEmoji = () => {
    const trimmed = emoji.trim();
    if (trimmed && trimmed !== category.emoji) {
      updateCategory.mutate({ id: category.id, emoji: trimmed });
    } else {
      setEmoji(category.emoji);
    }
    setEditingEmoji(false);
  };

  const handleDelete = () => {
    if (!confirm(`¿Borrar la categoría "${category.name}"? Los lugares que la usan pasarán a no tener categoría válida — cámbiales antes la categoría si la usas.`))
      return;
    deleteCategory.mutate(category.id);
  };

  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-sm)] bg-surface px-3 py-2 shadow-[var(--shadow-sm)]">
      {editingEmoji ? (
        <Input
          autoFocus
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          onBlur={saveEmoji}
          onKeyDown={(e) => e.key === "Enter" && saveEmoji()}
          maxLength={4}
          className="!w-11 h-8 px-1 text-center text-base shrink-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingEmoji(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base hover:brightness-95"
          aria-label={`Cambiar emoji de ${category.name}`}
        >
          {category.emoji}
        </button>
      )}

      <span className={`flex-1 truncate text-sm font-medium ${isHidden ? "text-muted-foreground" : ""}`}>
        {category.name}
      </span>

      {!category.is_builtin && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Borrar categoría ${category.name}`}
          className="shrink-0 text-muted-foreground hover:text-danger p-1"
        >
          <Trash2 size={16} />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleHidden}
        aria-label={isHidden ? "Mostrar en este viaje" : "Ocultar en este viaje"}
        className="shrink-0 text-muted-foreground hover:text-foreground p-1"
      >
        {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
