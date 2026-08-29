"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Evita createPortal(document.body) durante el render de servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/35 animate-[fadeIn_180ms_ease-out]"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative w-full sm:max-w-lg sm:mx-4 max-h-[88vh] overflow-y-auto",
          "bg-surface rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)]",
          "shadow-[var(--shadow-md)] animate-[slideUp_220ms_cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 pt-5 pb-3 bg-surface">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors duration-150 ease-out"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(16px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
