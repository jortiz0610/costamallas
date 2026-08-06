"use client";

// ============================================================
// Postventa: la tarjeta con el QR de la encuesta, lista para imprimir.
//
// Se pega en la entrega, se deja con el acta de instalación o se manda
// por WhatsApp. Lleva a la reseña de Google.
//
// Si falta el enlace, la pantalla lo dice y NO muestra un QR de mentira.
// Un código impreso que no lleva a ninguna parte ya no se puede
// corregir: está en cientos de papeles.
// ============================================================

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Loader2, Printer, AlertTriangle, ExternalLink, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { useBrand } from "@/contexts/BrandContext";

interface ConfigPostventa {
  urlResena: string; encuestaTitulo: string; encuestaTexto: string;
}

function Contenido() {
  const { brand } = useBrand();

  const { data, isLoading } = useQuery<{ data: ConfigPostventa }>({
    queryKey: ["config-postventa"],
    queryFn: async () => (await (await fetch("/api/configuracion/postventa")).json()),
  });

  const cfg = data?.data;

  return (
    <>
      <Topbar title="Postventa" actions={
        <div className="flex items-center gap-2 no-print">
          <Link href="/politicas" target="_blank" className="btn-secondary btn-sm">
            <FileText size={13} /> Políticas
          </Link>
          <Link href="/configuracion?tab=postventa" className="btn-secondary btn-sm">
            <Settings size={13} /> Configurar
          </Link>
          <button onClick={() => window.print()} disabled={!cfg?.urlResena}
            className="btn-secondary btn-sm disabled:opacity-40">
            <Printer size={13} /> Imprimir
          </button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: brand.brandColor }} /></div>
        ) : !cfg?.urlResena ? (
          <div className="card p-8 max-w-lg mx-auto text-center no-print">
            <AlertTriangle size={26} className="mx-auto mb-3 text-amber-500" />
            <p className="text-sm font-bold text-soft">Falta el enlace de reseñas de Google</p>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              El QR lleva a la página donde el cliente deja la reseña. Mientras no esté cargado, esta pantalla no genera
              ningún código: uno impreso que no funciona ya no se puede corregir.
            </p>
            <p className="text-xs text-muted mt-3 leading-relaxed">
              Se saca del perfil de negocio de Google: buscar la empresa → <b>Pedir reseñas</b> → copiar el enlace corto.
            </p>
            <Link href="/configuracion?tab=postventa"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: brand.brandColor }}>
              <Settings size={13} /> Cargarlo ahora
            </Link>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="card p-4 flex items-center justify-between gap-3 no-print">
              <p className="text-xs text-muted min-w-0">
                El QR apunta a{" "}
                <a href={cfg.urlResena} target="_blank" rel="noreferrer"
                  className="font-mono break-all hover:underline" style={{ color: brand.brandColor }}>
                  {cfg.urlResena}
                </a>
              </p>
              <a href={cfg.urlResena} target="_blank" rel="noreferrer" className="btn-secondary btn-sm flex-shrink-0">
                <ExternalLink size={13} /> Probarlo
              </a>
            </div>

            {/* La tarjeta. Se imprime sola en media carta. */}
            <div className="print-area mx-auto" style={{ maxWidth: 460 }}>
              <div style={{ backgroundColor: "#fff", border: "1px solid #e5e5e0" }}>
                <div style={{ backgroundColor: "#11110f", padding: "22px 26px" }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "#ffdd00" }}>
                    {brand.companyName}
                  </p>
                  <h2 style={{ margin: "8px 0 0", fontSize: 27, lineHeight: 1, color: "#fff", textTransform: "uppercase", fontWeight: 900 }}>
                    {cfg.encuestaTitulo}
                  </h2>
                </div>
                <div style={{ height: 4, backgroundColor: "#ffdd00" }} />

                <div style={{ padding: "26px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.65, color: "#2b2d29" }}>
                    {cfg.encuestaTexto}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/api/postventa/qr?tam=520" alt="Código QR de la encuesta de satisfacción"
                    style={{ width: 240, height: 240, margin: "0 auto", display: "block" }} />
                  <p style={{ margin: "18px 0 0", fontSize: 11, color: "#6b6f6a", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>
                    Apunte la cámara al código
                  </p>
                </div>

                <div style={{ padding: "12px 26px", backgroundColor: "#11110f", color: "rgba(255,255,255,.5)", fontSize: 10, textAlign: "center" }}>
                  Gracias por confiar en {brand.companyName}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted text-center no-print">
              Imprímela y déjala con la entrega, o adjúntala al acta de instalación. El código es el mismo siempre:
              basta imprimirla una vez y fotocopiarla.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><Contenido /></Suspense>; }
