"use client";

// ============================================================
// Acta de entrega de la obra, para imprimir y firmar en sitio.
//
// Es el papel que cierra la instalación: qué se instaló, qué se
// verificó, quién lo recibió y con qué observaciones. Sin esto, cuando
// aparece un reclamo tres meses después no hay nada que mostrar salvo
// la memoria de quien estuvo ahí.
//
// Lleva el QR de la encuesta de satisfacción: el mejor momento para
// pedir una reseña es cuando la obra acaba de quedar bien, no una
// semana después por correo.
// ============================================================

import { Suspense, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Loader2, ArrowLeft, Printer, Save } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useBrand } from "@/contexts/BrandContext";
import { formatCOP, formatDateShort } from "@/lib/utils";

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";
const TINTA = "#2b2d29";

interface ItemActa {
  descripcion: string; cantidad: number; unidad: string | null; subtotal: number;
}
interface Acta {
  id: string; estado: string; fechaAgendada: string | null; fechaRealizada: string | null;
  direccion: string | null; ciudad: string | null; notas: string | null;
  checklist: { texto: string; hecho: boolean }[];
  fotos: { url: string; momento: string }[];
  actaRecibidoPor: string | null; actaDocumento: string | null;
  actaObservaciones: string | null; actaFirmadaEn: string | null;
  tecnico: { nombre: string; telefono: string | null } | null;
  pedido: {
    numero: string; total: number; direccionEntrega: string | null;
    cliente: {
      nombre: string; empresa: string | null; nit: string | null;
      telefono: string | null; direccion: string | null; ciudad: string | null;
    };
    vendedor: { nombre: string } | null;
    items: ItemActa[];
  };
}

function Contenido() {
  const { id } = useParams<{ id: string }>();
  const { brand } = useBrand();
  const [recibidoPor, setRecibidoPor] = useState("");
  const [documento, setDocumento] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading, refetch } = useQuery<Acta>({
    queryKey: ["instalacion-acta", id],
    queryFn: async () => (await (await fetch(`/api/crm/instalaciones/${id}`)).json()).data,
  });

  // El QR solo se muestra si la URL de reseñas está cargada. Un recuadro
  // vacío en un acta impresa queda peor que no ponerlo.
  const { data: postventa } = useQuery<{ data: { urlResena: string } }>({
    queryKey: ["config-postventa"],
    queryFn: async () => (await (await fetch("/api/configuracion/postventa")).json()),
  });
  const hayQR = Boolean(postventa?.data?.urlResena);

  useEffect(() => {
    if (!data) return;
    setRecibidoPor(data.actaRecibidoPor ?? "");
    setDocumento(data.actaDocumento ?? "");
    setObservaciones(data.actaObservaciones ?? "");
  }, [data]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/instalaciones/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actaRecibidoPor: recibidoPor,
          actaDocumento: documento,
          actaObservaciones: observaciones,
          actaFirmada: Boolean(recibidoPor.trim()),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Acta guardada");
      refetch();
    } finally { setGuardando(false); }
  };

  if (isLoading || !data) {
    return (
      <>
        <Topbar title="Acta de entrega" />
        <div className="flex-1 flex items-center justify-center page-bg">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--brand-color)" }} />
        </div>
      </>
    );
  }

  const c = data.pedido.cliente;
  const donde = [data.direccion || data.pedido.direccionEntrega || c.direccion, data.ciudad || c.ciudad]
    .filter(Boolean).join(", ");
  const fecha = data.fechaRealizada ?? data.fechaAgendada;
  const antes = data.fotos.filter(f => f.momento === "ANTES").length;
  const despues = data.fotos.filter(f => f.momento === "DESPUES").length;

  return (
    <>
      <Topbar title={`Acta · ${data.pedido.numero}`} actions={
        <div className="flex items-center gap-2 no-print">
          <Link href="/crm/instalaciones" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
          <button onClick={guardar} disabled={guardando} className="btn-secondary btn-sm">
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
          </button>
          <button onClick={() => window.print()} className="btn-secondary btn-sm"><Printer size={13} /> Imprimir</button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        {/* Lo que se escribe en el portal (no se imprime): lo que ya se
            sabe de antemano sale impreso; lo demás se llena a mano. */}
        <div className="max-w-3xl mx-auto mb-5 card p-5 no-print">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Datos de quien recibe</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Nombre</label>
              <input className="input py-1.5 text-xs" value={recibidoPor} onChange={e => setRecibidoPor(e.target.value)}
                placeholder="Quién recibe en sitio" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Documento</label>
              <input className="input py-1.5 text-xs" value={documento} onChange={e => setDocumento(e.target.value)}
                placeholder="C.C. / NIT" />
            </div>
          </div>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-1 mt-3">Observaciones</label>
          <textarea className="input resize-none text-xs" rows={2} value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Lo que haya que dejar por escrito de esta entrega." />
          <p className="text-[11px] text-muted mt-2">
            Se puede imprimir en blanco y llenar a mano en la obra. Si se escribe aquí, sale impreso y queda guardado.
          </p>
        </div>

        {/* El acta */}
        <div className="print-area mx-auto" style={{ maxWidth: "210mm" }}>
          <div style={{ backgroundColor: "#fff", color: TINTA }}>
            {/* Cabecera */}
            <div style={{ backgroundColor: NEGRO, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: AMARILLO }}>
                  {brand.companyName}
                </p>
                <h1 style={{ margin: "8px 0 0", fontSize: 26, lineHeight: 1, color: "#fff", textTransform: "uppercase", fontWeight: 900 }}>
                  Acta de entrega
                </h1>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".1em" }}>Pedido</p>
                <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 900, color: AMARILLO }}>{data.pedido.numero}</p>
              </div>
            </div>
            <div style={{ height: 4, backgroundColor: AMARILLO }} />

            <div style={{ padding: "24px 28px" }}>
              {/* Datos */}
              <Rejilla>
                <Dato titulo="Cliente" valor={c.empresa || c.nombre} />
                <Dato titulo="NIT / C.C." valor={c.nit ?? "—"} />
                <Dato titulo="Contacto" valor={c.telefono ?? "—"} />
                <Dato titulo="Fecha de la obra" valor={fecha ? formatDateShort(fecha) : "—"} />
                <Dato titulo="Sitio de instalación" valor={donde || "—"} ancho />
                <Dato titulo="Técnico responsable" valor={data.tecnico?.nombre ?? "—"} />
                <Dato titulo="Asesor comercial" valor={data.pedido.vendedor?.nombre ?? "—"} />
              </Rejilla>

              {/* Qué se instaló */}
              <Titulo>Lo que se instaló</Titulo>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 18 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f7f6f0" }}>
                    <th style={th}>Descripción</th>
                    <th style={{ ...th, textAlign: "right", width: 110 }}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pedido.items.map((i, n) => (
                    <tr key={n}>
                      <td style={td}>{i.descripcion}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        {i.cantidad.toLocaleString("es-CO")} {i.unidad ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Verificación */}
              <Titulo>Verificación en sitio</Titulo>
              <div style={{ marginBottom: 18 }}>
                {(data.checklist?.length ? data.checklist : [{ texto: "Sin checklist registrado", hecho: false }]).map((p, n) => (
                  <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "5px 0", fontSize: 12 }}>
                    <span style={{
                      width: 13, height: 13, border: `2px solid ${NEGRO}`, flexShrink: 0, marginTop: 1,
                      backgroundColor: p.hecho ? NEGRO : "transparent",
                      color: AMARILLO, fontSize: 9, lineHeight: "10px", textAlign: "center", fontWeight: 900,
                    }}>{p.hecho ? "✓" : ""}</span>
                    <span>{p.texto}</span>
                  </div>
                ))}
                <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "#6b6f6a" }}>
                  Registro fotográfico: {antes} foto{antes === 1 ? "" : "s"} de antes y {despues} de después,
                  archivadas en el portal.
                </p>
              </div>

              {/* Observaciones */}
              <Titulo>Observaciones</Titulo>
              <div style={{
                minHeight: 54, border: "1px solid #e5e5e0", padding: "10px 12px", marginBottom: 22,
                fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-line",
              }}>
                {observaciones || data.notas || ""}
              </div>

              {/* Conformidad y firmas */}
              <div style={{ backgroundColor: "#f7f6f0", padding: "14px 16px", marginBottom: 20, fontSize: 11.5, lineHeight: 1.65 }}>
                Quien firma declara que recibió a conformidad los trabajos descritos en esta acta, que fueron
                ejecutados en el sitio indicado y que verificó los puntos relacionados arriba. Las observaciones
                consignadas hacen parte de este documento. La garantía y las condiciones de servicio son las
                publicadas por {brand.companyName}.
              </div>

              <div style={{ display: "flex", gap: 28, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ borderBottom: `2px solid ${NEGRO}`, height: 46 }} />
                  <p style={{ margin: "6px 0 0", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Firma de quien recibe
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11 }}>{recibidoPor || "Nombre: ______________________"}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 11 }}>
                    {documento ? `Documento: ${documento}` : "Documento: ___________________"}
                  </p>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ borderBottom: `2px solid ${NEGRO}`, height: 46 }} />
                  <p style={{ margin: "6px 0 0", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Firma del técnico
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11 }}>{data.tecnico?.nombre ?? "Nombre: ______________________"}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 11 }}>{brand.companyName}</p>
                </div>

                {/* El mejor momento para pedir una reseña es cuando la
                    obra acaba de quedar bien. */}
                {hayQR && (
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/api/postventa/qr?tam=260" alt="Encuesta de satisfacción"
                      style={{ width: 92, height: 92, display: "block" }} />
                    <p style={{ margin: "4px 0 0", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800, maxWidth: 92, lineHeight: 1.3 }}>
                      ¿Cómo nos fue?
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: "12px 28px", backgroundColor: NEGRO, color: "rgba(255,255,255,.45)", fontSize: 10 }}>
              {brand.companyName}
              {brand.nit ? ` · NIT ${brand.nit}` : ""}
              {brand.phone ? ` · ${brand.phone}` : ""}
              {" · Valor del pedido: "}{formatCOP(data.pedido.total)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  textAlign: "left", padding: "7px 10px", fontSize: 9.5, fontWeight: 800,
  textTransform: "uppercase", letterSpacing: ".1em", color: "#6b6f6a",
};
const td: React.CSSProperties = {
  padding: "7px 10px", fontSize: 12, borderBottom: "1px solid #eeede7",
};

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-block", backgroundColor: NEGRO, color: AMARILLO, padding: "4px 10px", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Rejilla({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginBottom: 22 }}>{children}</div>;
}

function Dato({ titulo, valor, ancho = false }: { titulo: string; valor: string; ancho?: boolean }) {
  return (
    <div style={ancho ? { gridColumn: "span 2" } : undefined}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: "#6b6f6a" }}>{titulo}</p>
      <p style={{ margin: "2px 0 0", fontSize: 12.5, fontWeight: 600 }}>{valor}</p>
    </div>
  );
}

export default function Page() { return <Suspense><Contenido /></Suspense>; }
