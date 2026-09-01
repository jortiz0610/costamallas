"use client";

// ============================================================
// La pantalla de campo. Un trabajo, un teléfono, una mano.
//
// La usa el de producción parado en un balcón, muchas veces con guantes
// y con media barra de señal. Eso manda sobre todo lo demás:
//
//   · **Nada de precios.** Ni el total, ni el unitario. Quien mide no
//     negocia, y un número en pantalla es una conversación que no le
//     toca a él. Los precios ni siquiera se piden a la API.
//   · **Se guarda solo.** Cada campo se manda al dejar de escribir.
//     Perder veinte minutos de anotaciones por un botón de "guardar" al
//     final es como se deja de usar una herramienta.
//   · **Botones grandes.** 48 px de alto mínimo. Un dedo con guante no
//     acierta a un enlace de 13 px.
//   · **Una columna, siempre.** Esto no tiene versión de escritorio
//     porque no se usa en escritorio. Se centra y ya.
// ============================================================

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, MapPin, Phone, Ruler, ClipboardList, Plus, Trash2,
  PenLine, CheckCircle2, ArrowLeft, GraduationCap, Package,
} from "lucide-react";
import toast from "react-hot-toast";
import { Firma } from "@/components/campo/Firma";

interface Recomendado { nombre: string; cantidad?: number; unidad?: string; nota?: string }

interface Trabajo {
  id: string;
  tipo: "VISITA" | "INSTALACION";
  estado: string;
  fechaAgendada: string | null;
  donde: string;
  notas: string | null;
  esPrueba: boolean;
  medidas: string | null;
  condicionesSitio: string | null;
  recomendados: Recomendado[];
  firmadoEn: string | null;
  firmaNombre: string | null;
  actaObservaciones: string | null;
  cliente: { nombre: string; empresa: string | null; telefono: string | null } | null;
  pedido: { numero: string } | null;
  items: { descripcion: string; cantidad: number; unidad: string | null }[];
}

/** Un campo de texto que se guarda solo al salir de él. */
function CampoLargo({
  etiqueta, icono, valor, placeholder, onGuardar, filas = 4,
}: {
  etiqueta: string;
  icono: React.ReactNode;
  valor: string;
  placeholder: string;
  onGuardar: (v: string) => void;
  filas?: number;
}) {
  const [texto, setTexto] = useState(valor);
  const [guardado, setGuardado] = useState(false);
  const inicial = useRef(valor);

  const salir = () => {
    if (texto === inicial.current) return;
    inicial.current = texto;
    onGuardar(texto);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1600);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icono}
        <span className="text-[13.5px] font-bold text-soft flex-1">{etiqueta}</span>
        {guardado && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
            <CheckCircle2 size={12} /> Guardado
          </span>
        )}
      </div>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={salir}
        rows={filas}
        placeholder={placeholder}
        // 16 px o más: por debajo de eso, Safari en iPhone hace zoom al
        // enfocar el campo y deja la pantalla torcida.
        className="w-full rounded-xl border divider surface-2 p-3 outline-none resize-y"
        style={{ fontSize: 16, lineHeight: 1.5 }}
      />
    </div>
  );
}

function Contenido() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [firmando, setFirmando] = useState(false);
  const [guardandoFirma, setGuardandoFirma] = useState(false);
  const [quienFirma, setQuienFirma] = useState("");
  const [documento, setDocumento] = useState("");
  const [recomendados, setRecomendados] = useState<Recomendado[]>([]);

  const { data: t, isLoading, refetch } = useQuery<Trabajo>({
    queryKey: ["campo", id],
    queryFn: async () => {
      const r = await fetch(`/api/crm/trabajos/${id}/campo`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error ?? "No se pudo cargar");
      return j.data as Trabajo;
    },
  });

  useEffect(() => {
    if (t?.recomendados) setRecomendados(t.recomendados);
    if (t?.cliente && !quienFirma) setQuienFirma(t.cliente.empresa || t.cliente.nombre || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id]);

  const guardar = useCallback(async (parche: Record<string, unknown>) => {
    const r = await fetch(`/api/crm/trabajos/${id}/campo`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parche),
    });
    if (!r.ok) toast.error("No se pudo guardar. Revise la señal.");
  }, [id]);

  const firmar = async (imagen: string) => {
    if (!quienFirma.trim()) {
      toast.error("Falta el nombre de quien recibe.");
      setFirmando(false);
      return;
    }
    setGuardandoFirma(true);
    try {
      const r = await fetch(`/api/crm/trabajos/${id}/campo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmaImagen: imagen,
          firmaNombre: quienFirma.trim(),
          firmaDocumento: documento.trim() || undefined,
          recibidoPor: quienFirma.trim(),
        }),
      });
      const j = await r.json();
      if (!j.success) { toast.error(j.error ?? "No se pudo firmar"); return; }
      setFirmando(false);
      toast.success(t?.tipo === "VISITA" ? "Visita cerrada" : "Entrega firmada");
      refetch();
    } catch {
      toast.error("Sin conexión. Inténtelo otra vez.");
    } finally {
      setGuardandoFirma(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center page-bg">
        <Loader2 size={22} className="animate-spin text-muted" />
      </div>
    );
  }
  if (!t) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 page-bg p-8 text-center">
        <p className="text-sm font-bold text-soft">Este trabajo no existe</p>
        <button onClick={() => router.push("/crm/trabajos")} className="btn-secondary btn-sm">Volver</button>
      </div>
    );
  }

  const esVisita = t.tipo === "VISITA";
  const cerrado = Boolean(t.firmadoEn);
  const quien = t.cliente?.empresa || t.cliente?.nombre || "Cliente";

  return (
    <>
      {firmando && (
        <Firma
          titulo={esVisita ? "Firma de la visita" : "Firma de entrega"}
          guardando={guardandoFirma}
          onCancelar={() => setFirmando(false)}
          onFirmar={firmar}
        />
      )}

      <div className="flex-1 overflow-y-auto page-bg">
        {/* Cabecera propia: esta pantalla no usa la Topbar del portal
            porque en campo el menú de módulos no sirve para nada. */}
        <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 topbar-bg border-b divider">
          <button onClick={() => router.push("/crm/trabajos")} className="text-muted p-1 -ml-1" aria-label="Volver">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-soft truncate">{quien}</p>
            <p className="text-[11.5px] text-muted">
              {esVisita ? "Visita técnica" : `Instalación${t.pedido ? ` · ${t.pedido.numero}` : ""}`}
            </p>
          </div>
          {t.esPrueba && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
              style={{ backgroundColor: "#7c3aed1f", color: "#7c3aed" }}>
              <GraduationCap size={11} /> Práctica
            </span>
          )}
        </div>

        <div className="max-w-lg mx-auto p-3 space-y-3 pb-8">

          {/* Dónde y a quién. Lo primero que se necesita al llegar. */}
          <div className="card p-4 space-y-3">
            {t.donde && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(t.donde)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-3 min-h-[48px]"
              >
                <MapPin size={18} className="flex-shrink-0" style={{ color: "var(--brand-color)" }} />
                <span className="text-[14px] text-soft flex-1 leading-snug">{t.donde}</span>
              </a>
            )}
            {t.cliente?.telefono && (
              <a href={`tel:${t.cliente.telefono}`} className="flex items-center gap-3 min-h-[48px]">
                <Phone size={18} className="flex-shrink-0" style={{ color: "var(--brand-color)" }} />
                <span className="text-[14px] text-soft flex-1">{t.cliente.telefono}</span>
              </a>
            )}
            {t.notas && (
              <p className="text-[13px] text-muted leading-relaxed pt-1 border-t divider">{t.notas}</p>
            )}
          </div>

          {/* Qué hay que instalar. Sin un solo precio. */}
          {!esVisita && t.items.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={15} style={{ color: "var(--brand-color)" }} />
                <span className="text-[13.5px] font-bold text-soft">Qué se instala</span>
              </div>
              <ul className="space-y-2">
                {t.items.map((i, n) => (
                  <li key={n} className="flex items-start gap-2 text-[13.5px] text-soft leading-snug">
                    <span className="font-bold tabular-nums flex-shrink-0" style={{ color: "var(--brand-color)" }}>
                      {i.cantidad}{i.unidad ? ` ${i.unidad}` : ""}
                    </span>
                    <span className="flex-1 min-w-0">{i.descripcion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cerrado ? (
            <div className="card p-5 text-center">
              <CheckCircle2 size={26} className="mx-auto mb-2 text-green-600" />
              <p className="text-[14.5px] font-bold text-soft">
                {esVisita ? "Visita cerrada" : "Entrega firmada"}
              </p>
              <p className="text-[12.5px] text-muted mt-1">
                Firmó {t.firmaNombre} el{" "}
                {new Date(t.firmadoEn!).toLocaleDateString("es-CO", { day: "2-digit", month: "long" })}.
              </p>
              <p className="text-[12px] text-muted mt-3 leading-relaxed">
                {esVisita
                  ? "Al asesor ya le llegó el formato para cotizar."
                  : "Al cliente ya le llegó el acta por correo."}
              </p>
            </div>
          ) : (
            <>
              <CampoLargo
                etiqueta="Medidas"
                icono={<Ruler size={15} style={{ color: "var(--brand-color)" }} />}
                valor={t.medidas ?? ""}
                placeholder={"Balcón principal: 3.20 x 1.10 m\nVentana cocina: 1.40 x 0.90 m"}
                onGuardar={v => guardar({ medidas: v })}
              />

              <CampoLargo
                etiqueta="Cómo está el sitio"
                icono={<ClipboardList size={15} style={{ color: "var(--brand-color)" }} />}
                valor={t.condicionesSitio ?? ""}
                placeholder="Pared en ladrillo, tercer piso, sin ascensor. Hay que taladrar."
                onGuardar={v => guardar({ condicionesSitio: v })}
                filas={3}
              />

              {/* Lo que recomienda quien está viendo el sitio. */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Plus size={15} style={{ color: "var(--brand-color)" }} />
                  <span className="text-[13.5px] font-bold text-soft flex-1">Qué recomienda</span>
                </div>
                <p className="text-[11.5px] text-muted mb-3 leading-relaxed">
                  Lo que hace falta según lo que está viendo. Los precios los pone el asesor.
                </p>

                <div className="space-y-2">
                  {recomendados.map((r, n) => (
                    <div key={n} className="flex items-start gap-2">
                      <input
                        value={r.nombre}
                        onChange={e => {
                          const copia = [...recomendados];
                          copia[n] = { ...copia[n], nombre: e.target.value };
                          setRecomendados(copia);
                        }}
                        onBlur={() => guardar({ recomendados })}
                        placeholder="Anclajes de expansión"
                        className="flex-1 min-w-0 rounded-xl border divider surface-2 px-3 py-3 outline-none"
                        style={{ fontSize: 16 }}
                      />
                      <input
                        value={r.cantidad ?? ""}
                        onChange={e => {
                          const copia = [...recomendados];
                          copia[n] = { ...copia[n], cantidad: Number(e.target.value) || undefined };
                          setRecomendados(copia);
                        }}
                        onBlur={() => guardar({ recomendados })}
                        inputMode="numeric"
                        placeholder="Cant."
                        className="w-20 rounded-xl border divider surface-2 px-2 py-3 outline-none text-center"
                        style={{ fontSize: 16 }}
                      />
                      <button
                        onClick={() => {
                          const copia = recomendados.filter((_, i) => i !== n);
                          setRecomendados(copia);
                          guardar({ recomendados: copia });
                        }}
                        className="p-3 text-muted flex-shrink-0"
                        aria-label="Quitar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setRecomendados([...recomendados, { nombre: "" }])}
                  className="w-full mt-2 py-3 rounded-xl border border-dashed divider text-[13px] font-semibold text-muted min-h-[48px]"
                >
                  + Agregar
                </button>
              </div>

              {/* Quién recibe y firma. */}
              <div className="card p-4 space-y-3">
                <span className="text-[13.5px] font-bold text-soft block">Quién recibe</span>
                <input
                  value={quienFirma}
                  onChange={e => setQuienFirma(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full rounded-xl border divider surface-2 px-3 py-3 outline-none"
                  style={{ fontSize: 16 }}
                />
                <input
                  value={documento}
                  onChange={e => setDocumento(e.target.value)}
                  inputMode="numeric"
                  placeholder="Cédula (opcional)"
                  className="w-full rounded-xl border divider surface-2 px-3 py-3 outline-none"
                  style={{ fontSize: 16 }}
                />
              </div>

              <button
                onClick={() => setFirmando(true)}
                disabled={!quienFirma.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[16px] disabled:opacity-35 transition-all"
                style={{ backgroundColor: "#11110f", color: "var(--brand-color)" }}
              >
                <PenLine size={19} />
                {esVisita ? "Cerrar visita con firma" : "Firmar entrega"}
              </button>

              <p className="text-[11.5px] text-muted text-center leading-relaxed px-4">
                {esVisita
                  ? "Al firmar, al asesor le llega el formato para cotizar y al cliente un aviso de que va la oferta."
                  : "Al firmar, al cliente le llega el acta de entrega por correo."}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Contenido /></Suspense>;
}
