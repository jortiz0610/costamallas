import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Costamallas ERP", template: "%s | Costamallas ERP" },
  description: "Portal de gestión de productos y WooCommerce para Costamallas",
  applicationName: "Costamallas ERP",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Costamallas",
    // `default` deja la barra de estado de iOS legible sobre el encabezado.
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Nunca bloqueamos el zoom: en un ERP con tablas densas el pinch-zoom es
  // una necesidad real de accesibilidad.
  maximumScale: 5,
  userScalable: true,
  // Cubre el notch / isla dinámica de iOS cuando corre instalada.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * `spellCheck` y `autoCapitalize` SE HEREDAN a todos los campos que
     * haya dentro. Por eso se ponen aquí una vez y no campo por campo en
     * las treinta y cinco cajas de texto del portal.
     *
     * Qué consiguen en un teléfono: el teclado enciende la barra de
     * sugerencias y corrige mientras se escribe, y la primera letra de
     * cada frase sale en mayúscula sola. Sin esto, escribirle a un
     * cliente desde el móvil era teclear cada letra a pelo.
     *
     * Va en español porque `lang="es"` está justo al lado: el corrector
     * usa el idioma del documento, y sin declararlo corregía en inglés.
     *
     * Donde NO conviene —claves de API, SKU, cajas de búsqueda— se apaga
     * en el campo concreto, que manda sobre lo heredado.
     */
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased" spellCheck autoCapitalize="sentences">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
