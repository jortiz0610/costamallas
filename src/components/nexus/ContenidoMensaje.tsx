"use client";

// ============================================================
// Cómo se pinta lo que hay dentro de una burbuja.
//
// Antes todo era texto plano: un enlace a una foto se veía como una
// ristra de 120 caracteres, y una cotización compartida quedaba igual de
// enterrada que una frase cualquiera. Ahora:
//
//   · Una URL de imagen se ve como la imagen.
//   · Un audio trae su reproductor.
//   · Un PDF u otro archivo, una tarjeta con su nombre.
//   · Un enlace normal queda subrayado y, si es del propio portal,
//     con una tarjeta que dice qué es (una cotización, un producto).
//
// La vista previa de enlaces EXTERNOS no baja la página para sacarle el
// título: eso sería una petición del servidor a un sitio de terceros por
// cada mensaje, con lo que tarda y lo que cuesta. Lo que se muestra sale
// de la propia URL, que para lo que hace falta —distinguir un enlace de
// una cotización de uno de YouTube— es suficiente.
// ============================================================

import { FileText, ExternalLink, Download } from "lucide-react";

const EXT_IMAGEN = /\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i;
const EXT_AUDIO = /\.(mp3|ogg|wav|webm|m4a|aac)(\?|$)/i;
const EXT_VIDEO = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const EXT_ARCHIVO = /\.(pdf|docx?|xlsx?|pptx?|zip|csv)(\?|$)/i;

/** Una URL suelta, para poder trocear el texto. */
const URL_RE = /(https?:\/\/[^\s<>"]+)/gi;

export function esUrlImagen(u: string) { return EXT_IMAGEN.test(u); }

/** Qué es este enlace, en una palabra que se pueda enseñar. */
function queEs(url: string): { titulo: string; detalle: string } | null {
  try {
    const u = new URL(url);
    const p = u.pathname;
    if (p.startsWith("/cotizacion/")) return { titulo: "Cotización", detalle: "Se abre sin iniciar sesión" };
    if (p.startsWith("/politicas")) return { titulo: "Políticas", detalle: "Envíos, devoluciones y datos" };
    if (u.hostname.includes("costamallas.com") && u.searchParams.get("p")) {
      return { titulo: "Producto en la tienda", detalle: u.hostname };
    }
    if (EXT_ARCHIVO.test(p)) {
      const nombre = decodeURIComponent(p.split("/").pop() ?? "archivo");
      return { titulo: nombre, detalle: u.hostname };
    }
    return null;
  } catch { return null; }
}

function TarjetaEnlace({ url }: { url: string }) {
  const info = queEs(url);
  if (!info) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="mt-1.5 flex items-center gap-2.5 px-2.5 py-2 rounded-xl surface border divider hover:surface-2 transition-colors no-underline">
      <FileText size={16} className="text-muted flex-shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold text-gray-800 dark:text-gray-100 truncate">{info.titulo}</span>
        <span className="block text-[10px] text-muted truncate">{info.detalle}</span>
      </span>
      <ExternalLink size={13} className="text-muted flex-shrink-0" />
    </a>
  );
}

function Adjunto({ url }: { url: string }) {
  const nombre = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "archivo");

  if (EXT_IMAGEN.test(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy"
          className="rounded-xl max-h-64 w-auto object-cover bg-black/5" />
      </a>
    );
  }

  if (EXT_AUDIO.test(url)) {
    // `preload="none"` dejaba el reproductor sin saber ni cuanto dura: en
    // varios navegadores la barra sale a cero, el play responde y no se
    // oye nada hasta el segundo intento. Con "metadata" se pide la
    // cabecera -unos pocos KB- y no el audio entero.
    return <audio controls preload="metadata" src={url} className="mt-1 w-full max-w-[260px] h-9" />;
  }

  if (EXT_VIDEO.test(url)) {
    return <video controls preload="metadata" src={url} className="mt-1 rounded-xl max-h-64 w-auto" />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" download
      className="mt-1 flex items-center gap-2.5 px-2.5 py-2 rounded-xl surface border divider hover:surface-2 transition-colors no-underline">
      <FileText size={16} className="text-muted flex-shrink-0" />
      <span className="text-[11.5px] font-medium text-gray-800 dark:text-gray-100 truncate flex-1">{nombre}</span>
      <Download size={13} className="text-muted flex-shrink-0" />
    </a>
  );
}

export function ContenidoMensaje({
  contenido,
  tipo,
  claro,
}: {
  contenido: string;
  /** `imagen`, `audio`, `video`, `archivo` o `texto`. */
  tipo?: string;
  /** true = la burbuja es de color y el texto va en blanco. */
  claro?: boolean;
}) {
  const trozos = contenido.split(URL_RE).filter(t => t !== "");
  const urls = trozos.filter(t => URL_RE.test(t) && /^https?:\/\//i.test(t));
  URL_RE.lastIndex = 0;

  // Un mensaje que es SOLO una o varias URLs de archivo se pinta como el
  // archivo, sin repetir el enlace debajo: es lo que hace el WhatsApp de
  // cualquiera y es lo que la gente espera.
  const soloEnlaces = urls.length > 0 && trozos.every(t => /^https?:\/\//i.test(t) || !t.trim());
  const soloAdjuntos = soloEnlaces && urls.every(u =>
    EXT_IMAGEN.test(u) || EXT_AUDIO.test(u) || EXT_VIDEO.test(u) || EXT_ARCHIVO.test(u));

  if (soloAdjuntos) {
    return (
      <span className="block space-y-1">
        {urls.map((u, i) => <Adjunto key={i} url={u} />)}
      </span>
    );
  }

  // Un tipo declarado manda sobre la extensión: es lo que sabe el
  // servidor, y hay URLs de adjunto sin extensión reconocible.
  if (tipo && tipo !== "texto" && /^https?:\/\//i.test(contenido.trim())) {
    return <Adjunto url={contenido.trim()} />;
  }

  return (
    <span className="block">
      <span className="block text-[13px] whitespace-pre-wrap break-words">
        {trozos.map((t, i) =>
          /^https?:\/\//i.test(t) ? (
            <a key={i} href={t} target="_blank" rel="noreferrer"
              className={`underline break-all ${claro ? "text-white/90" : ""}`}>
              {t.length > 60 ? t.slice(0, 57) + "…" : t}
            </a>
          ) : (
            <span key={i}>{t}</span>
          ),
        )}
      </span>
      {/* Solo la primera: cinco tarjetas en una burbuja no informan, tapan. */}
      {urls[0] && <TarjetaEnlace url={urls[0]} />}
    </span>
  );
}
