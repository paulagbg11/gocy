const LINE = "#2b2a27";
const TEAL = "#4d9a8e";
const TEAL_DARK = "#3a7d73";
const ORANGE = "#e85d2a";
const CREAM = "#f2d9a6";
const YELLOW = "#f2b84b";
const LENS = "#1f2a2e";

/**
 * Cámara réflex de carrete en color, al estilo de las ilustraciones retro:
 * capuchón verde azulado, rayas naranjas y crema y un objetivo grande con
 * brillo amarillo. Es el botón de las fotos y tiene que verse de un vistazo.
 */
export function AnalogCamera({ size = 58, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={(size * 46) / 64}
      viewBox="0 0 64 46"
      className={className}
      aria-hidden="true"
    >
      <g stroke={LINE} strokeWidth="1.2" strokeLinejoin="round">
        {/* Ruedas de arriba. */}
        <rect x="5" y="5" width="8" height="5" rx="1" fill="#5b5a55" />
        <rect x="14.5" y="3.5" width="9" height="6.5" rx="1" fill="#5b5a55" />
        <rect x="41" y="3.5" width="9" height="6.5" rx="1" fill="#5b5a55" />
        <rect x="51.5" y="5" width="7" height="5" rx="1" fill="#5b5a55" />

        {/* Cuerpo a rayas. */}
        <rect x="2" y="10" width="60" height="33" rx="3.5" fill={CREAM} />
        <path d="M2.6 18h58.8v5H2.6zM2.6 29h58.8v4.5H2.6z" fill={ORANGE} stroke="none" />
        <path d="M5.5 10h53a3.5 3.5 0 0 1 3.5 3.5V18H2v-4.5A3.5 3.5 0 0 1 5.5 10z" fill={TEAL} />
        <path d="M2 39.5h60V39.5a3.5 3.5 0 0 1-3.5 3.5h-53A3.5 3.5 0 0 1 2 39.5z" fill={TEAL} />
        <rect x="2" y="10" width="60" height="33" rx="3.5" fill="none" />

        {/* Capuchón del visor, con su placa. */}
        <path d="M21 13l3.5-8.5h15L43 13z" fill={TEAL} />
        <rect x="25" y="6.5" width="14" height="3" rx="0.8" fill={CREAM} strokeWidth="0.8" />

        {/* Botón de la izquierda y ventanilla del telémetro a la derecha. */}
        <circle cx="9" cy="15" r="2.2" fill={TEAL_DARK} />
        <circle cx="53" cy="17.5" r="4.6" fill={LENS} />
        <circle cx="53" cy="17.5" r="2.4" fill={YELLOW} strokeWidth="0.8" />
        <circle cx="54.5" cy="35.5" r="2" fill={TEAL_DARK} />

        {/* Objetivo. */}
        <circle cx="32" cy="27" r="14.5" fill={TEAL} />
        <circle cx="32" cy="27" r="11.8" fill="#3b3a36" />
        <circle cx="32" cy="27" r="9" fill={LENS} strokeWidth="0.9" />
        <circle cx="32" cy="27" r="5.6" fill="#2a3f45" strokeWidth="0.8" />
      </g>
      {/* Brillos del cristal. */}
      <path d="M22.4 21.5a11.8 11.8 0 0 1 6.2-6" stroke={YELLOW} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="29.3" cy="24.2" r="2.6" fill={YELLOW} />
      <circle cx="33" cy="23.4" r="1.1" fill="#7fc7bb" />
      <circle cx="34.6" cy="30" r="0.8" fill="#ffffff" opacity="0.7" />
    </svg>
  );
}
