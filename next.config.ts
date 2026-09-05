import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Para que el portal quepa en una imagen sin fuentes ──
  //
  // `standalone` empaqueta en `.next/standalone` SOLO lo necesario para
  // correr: el servidor y las dependencias que de verdad se usan. Sin
  // esto, la imagen del VPS tendría que llevar `node_modules` entero y,
  // con él, medio proyecto en texto.
  //
  // En Vercel no cambia nada: lo ignora y despliega como siempre.
  output: "standalone",

  // Sin mapas de origen en producción.
  //
  // Con ellos, cualquiera que abra las herramientas del navegador
  // reconstruye el TypeScript original con un clic — y entonces da
  // igual que en el servidor solo haya JavaScript compilado.
  productionBrowserSourceMaps: false,

  // pdf-parse usa fs/require nativo: no lo empaquetes, cárgalo como externo en el servidor
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "costamallas.com" },
      { protocol: "https", hostname: "*.costamallas.com" },
      { protocol: "https", hostname: "**.woocommerce.com" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // `camera=(self)` y `microphone=(self)`, NO `()`.
        //
        // Con la lista vacía el navegador le prohíbe al propio portal
        // usar la cámara y el micrófono, y `getUserMedia` falla ANTES de
        // preguntar nada: no sale el diálogo de permiso, así que parece
        // que el botón de grabar no hace nada. Es exactamente lo que
        // pasaba con las notas de voz del chat.
        //
        // `self` deja que los use ESTE dominio y sigue bloqueándolos para
        // cualquier iframe de terceros, que es de lo que protege esta
        // cabecera. La geolocalización se queda cerrada: el portal no la
        // usa para nada.
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-DNS-Prefetch-Control", value: "on" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self' https:",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
