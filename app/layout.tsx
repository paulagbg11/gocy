import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ProfileProvider } from "@/components/profile/ProfileProvider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GoCy",
  description: "Planifica vuestros viajes juntos: mapa, días y reservas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GoCy",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#12191c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${outfit.variable} h-full antialiased`}>
      {/* h-full (no solo min-h-full): un descendiente con % de altura necesita
          que TODOS los ancestros tengan `height` explícito, no solo min-height
          — si no, la altura no se propaga y cosas como el mapa de Google
          quedan a 0px de alto. Ver MapResizeFix.tsx para más contexto. */}
      <body className="h-full flex flex-col overscroll-none">
        <QueryProvider>
          <ProfileProvider>{children}</ProfileProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
