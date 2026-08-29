"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "./ProfileProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ProfilePicker() {
  const { profiles, chooseProfile, sessionReady } = useProfile();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handlePick = (id: string) => {
    chooseProfile(id);
    router.replace("/trips");
  };

  if (!sessionReady) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Conectando…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-10">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">¿Quién eres?</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Elige tu nombre para empezar a planificar viajes juntos.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 max-w-sm">
        {profiles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay perfiles todavía. Crea las migraciones de Supabase (ver README).
          </p>
        )}
        {profiles.map((profile) =>
          editingId === profile.id ? (
            <RenameForm key={profile.id} profileId={profile.id} initialName={profile.name} onDone={() => setEditingId(null)} />
          ) : (
            <button
              key={profile.id}
              onClick={() => handlePick(profile.id)}
              className="group flex flex-col items-center gap-3 w-32 focus-visible:outline-none"
            >
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-[var(--shadow-md)] transition-transform duration-150 ease-out group-hover:scale-105 group-focus-visible:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2"
                style={{ background: profile.color }}
              >
                {profile.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-medium">{profile.name}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(profile.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    setEditingId(profile.id);
                  }
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
              >
                editar nombre
              </span>
            </button>
          ),
        )}
      </div>
    </main>
  );
}

function RenameForm({
  profileId,
  initialName,
  onDone,
}: {
  profileId: string;
  initialName: string;
  onDone: () => void;
}) {
  const { renameProfile } = useProfile();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return onDone();
    setSaving(true);
    await renameProfile(profileId, name.trim());
    setSaving(false);
    onDone();
  };

  return (
    <div className="flex flex-col items-center gap-2 w-32">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="text-center h-9"
      />
      <div className="flex gap-1.5">
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
