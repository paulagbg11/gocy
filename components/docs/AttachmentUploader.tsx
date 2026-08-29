"use client";

import { useRef, useState } from "react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "@/lib/queries/documents";
import { Button } from "@/components/ui/Button";

export function AttachmentUploader({ tripId, documentId }: { tripId: string; documentId: string }) {
  const { data: attachments = [] } = useAttachments(documentId);
  const upload = useUploadAttachment();
  const remove = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    await upload.mutateAsync({ tripId, documentId, file });
    if (inputRef.current) inputRef.current.value = "";
  };

  const openAttachment = async (id: string) => {
    setOpeningId(id);
    try {
      const res = await fetch(`/api/attachments/${id}`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Adjuntos</Label>
      <div className="flex flex-col gap-1.5">
        {attachments.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-sm"
          >
            <Paperclip size={14} className="shrink-0 text-muted-foreground" />
            <button
              type="button"
              onClick={() => openAttachment(a.id)}
              className="flex-1 truncate text-left underline decoration-dotted"
              disabled={openingId === a.id}
            >
              {openingId === a.id ? "Abriendo…" : a.file_name ?? "Archivo"}
            </button>
            <button
              type="button"
              onClick={() => remove.mutate({ id: a.id, documentId, storagePath: a.storage_path })}
              aria-label="Quitar adjunto"
              className="shrink-0 text-muted-foreground hover:text-danger"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        Adjuntar archivo
      </Button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-muted-foreground">{children}</span>;
}
