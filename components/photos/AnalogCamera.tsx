/**
 * Cámara de carrete, dibujada al estilo de los iconos de lucide (trazo de 2,
 * sin relleno). Lucide solo tiene la cámara moderna.
 */
export function AnalogCamera({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Visor y disparador, sobre el cuerpo. */}
      <path d="M5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M15.5 7V5.5h3V7" />
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <circle cx="12" cy="13.5" r="4" />
      <circle cx="12" cy="13.5" r="1.5" />
      <path d="M2 11h4M18 11h4" />
    </svg>
  );
}
