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

  // pdf-parse usa fs/require nativo: no lo empaquetes, cárgalo como externo en el servidor.
  //
  // puppeteer-core, por lo mismo y por algo más: si se empaqueta, el
  // rastreador de `standalone` puede dejarse fuera archivos que la
  // librería carga a mano, y entonces el PDF falla SOLO en el contenedor
  // —en desarrollo funciona— que es la peor forma de encontrarse un
  // fallo.
  serverExternalPackages: ["pdf-parse", "puppeteer-core"],
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
            // `blob:` hace falta para VER lo que uno acaba de elegir sin
            // haberlo subido todavía: las vistas previas de las fotos de
            // un producto nuevo son URLs de memoria. Sin esto el
            // navegador las bloquea y se ven iconos rotos.
            //
            // No abre nada: un blob lo crea la propia página y vive solo
            // en esta pestaña. No se puede apuntar a un servidor ajeno.
            "img-src 'self' data: blob: https:",
            "font-src 'self'",
            "connect-src 'self' https:",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
