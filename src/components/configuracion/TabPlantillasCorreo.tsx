"use client";

// ============================================================
// Editor de las plantillas de correo, con vista previa en vivo.
//
// Tres decisiones que explican cómo se ve:
//
//   1. **El cuerpo se escribe en texto plano.** Quien edita esto es
//      gerencia, no un programador. El diseño —banner, botones, pie— lo
//      pone el portal alrededor. Un editor de HTML libre acabaría con un
//      correo roto en el primer copiar-pegar desde Word.
//   2. **La vista previa es el correo de verdad**, renderizado por el
//      servidor con el mismo código que lo manda, y con los marcadores
//      rellenos con ejemplos. Una previa "aproximada" no sirve para
//      decidir si un correo se ve bien.
//   3. **Volver al original BORRA lo guardado**, no copia el texto de
//      fábrica. Así, si algún día se corrige un texto por defecto, quien
//      no lo haya editado recibe la corrección.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Mail, Loader2, Save, RotateCcw, Eye, HelpCircle, Check, FileText,
  AlertTriangle, ExternalLink,
} from "lucide-react";
import type { PlantillaCorreo, CategoriaCorreo } from "@/lib/correo-plantillas";
import { marcadoresSueltos } from "@/lib/correo-plantillas";

interface PlantillaEditada extends PlantillaCorreo { editada: boolean }

interface Respuesta {
  plantillas: PlantillaEditada[];
  categorias: { v: CategoriaCorreo; l: string; d: string }[];
  urlCatalogo: string | null;
}

export function TabPlantillasCorreo() {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [borrador, setBorrador] = useState({ asunto: "", cuerpo: "", boton: "" });
  const [guardando, setGuardando] = useState(false);
  const [previa, setPrevia] = useState<{ asunto: string; html: string } | null>(null);
  const [catalogo, setCatalogo] = useState("");

  const { data, isLoading, refetch } = useQuery<Respuesta>({
    queryKey: ["correo-plantillas"],
    queryFn: async () => {
      const j = await (await fetch("/api/configuracion/correo-plantillas")).json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const plantillas = useMemo(() => data?.plantillas ?? [], [data]);
  const actual = plantillas.find(p => p.clave === seleccionada) ?? null;

  // Al abrir la pestaña, seleccionar la primera.
  useEffect(() => {
    if (!seleccionada && plantillas.length) setSeleccionada(plantillas[0].clave);
  }, [plantillas, seleccionada]);

  useEffect(() => {
    if (data?.urlCatalogo !== undefined) setCatalogo(data.urlCatalogo ?? "");
  }, [data?.urlCatalogo]);

  // Al cambiar de plantilla, cargar su texto en el editor.
  useEffect(() => {
    if (!actual) return;
    setBorrador({ asunto: actual.asunto, cuerpo: actual.cuerpo, boton: actual.boton ?? "" });
  }, [actual?.clave]); // eslint-disable-line react-hooks/exhaustive-deps

  // La vista previa se pide al servidor con un respiro, para no llamar
  // en cada tecla.
  useEffect(() => {
    if (!seleccionada || !borrador.cuerpo) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/configuracion/correo-plantillas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clave: seleccionada, ...borrador }),
        });
        const j = await res.json();
        if (j.success) setPrevia({ asunto: j.data.asunto, html: j.data.html });
      } catch { /* la previa no es crítica: si falla, se queda la anterior */ }
    }, 450);
    return () => clearTimeout(t);
  }, [seleccionada, borrador]);

  const sueltos = actual
    ? marcadoresSueltos(borrador.asunto + " " + borrador.cuerpo)
        .filter(m => m !== "{{empresa}}" && !actual.marcadores.some(x => x.k === m))
    : [];

  const cambiado = actual
    ? borrador.asunto !== actual.asunto ||
      borrador.cuerpo !== actual.cuerpo ||
      borrador.boton !== (actual.boton ?? "")
    : false;

  const guardar = async () => {
    if (!actual) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/correo-plantillas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clave: actual.clave,
          asunto: borrador.asunto,
          cuerpo: borrador.cuerpo,
          boton: actual.boton !== undefined ? borrador.boton : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Plantilla guardada");
      refetch();
    } catch { toast.error("Error de conexión"); }
    finally { setGuardando(false); }
  };

  const volverAlOriginal = async () => {
    if (!actual) return;
    if (!confirm(`¿Volver "${actual.nombre}" al texto original?`)) return;
    const res = await fetch("/api/configuracion/correo-plantillas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: actual.clave, asunto: null, cuerpo: null, boton: null }),
    });
    const j = await res.json();
    if (!j.success) return toast.error(j.error ?? "No se pudo restaurar");
    toast.success("Volvió al texto original");
    await refetch();
  };

  const guardarCatalogo = async () => {
    const res = await fetch("/api/configuracion/correo-plantillas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urlCatalogo: catalogo }),
    });
    const j = await res.json();
    if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
    toast.success(catalogo ? "Catálogo guardado" : "El botón del catálogo ya no sale");
    refetch();
  };

  const insertarMarcador = (m: string) => {
    setBorrador(b => ({ ...b, cuerpo: b.cuerpo + m }));
  };

  if (isLoading) {
    return <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Mail size={16} className="text-gray-400" /> Plantillas de correo
        </h2>
        <p className="text-[12px] text-gray-500 dark:text-slate-400 mt-1 max-w-3xl">
          Todo lo que el portal le manda a un cliente o al equipo. El cuerpo se escribe en texto
          normal: el diseño —la cabecera, el banner con el catálogo y la tienda, y el pie con los
          teléfonos— lo pone el portal alrededor, igual en todos.
        </p>
      </div>

      {/* El banner: qué enlaza */}
      <div className="card p-4">
        <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
          <FileText size={13} className="text-gray-400" /> El catálogo del banner
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5 mb-2.5">
          El banner de todos los correos lleva dos botones: la tienda (fija) y el catálogo en PDF.
          Si aquí no hay nada, el botón del catálogo <strong>no sale</strong>: un enlace roto en un
          correo a un cliente es peor que un botón que falta.
        </p>
        <div className="flex gap-2">
          <input
            className="input py-1.5 text-xs flex-1"
            placeholder="https://costamallas.com/…/Catalogo-PRO-CM-2026.pdf"
            value={catalogo}
            onChange={e => setCatalogo(e.target.value)}
          />
          <button onClick={guardarCatalogo} className="btn-secondary btn-sm">
            <Save size={12} /> Guardar
          </button>
          {data?.urlCatalogo && (
            <a href={data.urlCatalogo} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        {!data?.urlCatalogo && (
          <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: "#b45309" }}>
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            Falta subir el <code>Catalogo PRO CM 2026.pdf</code> a algún sitio público (la
            biblioteca de WordPress sirve) y pegar aquí su dirección.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Lista por categoría */}
        <div className="space-y-4">
          {(data?.categorias ?? []).map(cat => {
            const lista = plantillas.filter(p => p.categoria === cat.v);
            if (!lista.length) return null;
            return (
              <div key={cat.v}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  {cat.l}
                </p>
                <p className="text-[10.5px] text-gray-400 mb-2">{cat.d}</p>
                <div className="space-y-1">
                  {lista.map(p => (
                    <button
                      key={p.clave}
                      onClick={() => setSeleccionada(p.clave)}
                      className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                      style={seleccionada === p.clave
                        ? { backgroundColor: "var(--brand-color)18", color: "var(--brand-color)" }
                        : {}}
                    >
                      <span className="text-[12px] font-medium block truncate">
                        {p.nombre}
                        {p.editada && (
                          <span className="text-[9px] font-bold uppercase ml-1.5 px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                            editada
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Editor + previa */}
        {actual && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{actual.nombre}</p>
                  <p className="text-[11.5px] text-gray-400 mt-0.5">{actual.cuando}</p>
                </div>
                <div className="flex items-center gap-2">
                  {actual.editada && (
                    <button onClick={volverAlOriginal} className="btn-secondary btn-sm">
                      <RotateCcw size={12} /> Volver al original
                    </button>
                  )}
                  <button onClick={guardar} disabled={!cambiado || guardando} className="btn-primary btn-sm disabled:opacity-40">
                    {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
                  </button>
                </div>
              </div>

              {actual.nota && (
                <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg text-[11.5px]"
                  style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                  <HelpCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{actual.nota}</span>
                </div>
              )}

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Asunto
                  </label>
                  <input className="input py-1.5 text-xs" value={borrador.asunto}
                    onChange={e => setBorrador(b => ({ ...b, asunto: e.target.value }))} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Cuerpo
                  </label>
                  <textarea className="input resize-y text-xs font-mono" rows={14} value={borrador.cuerpo}
                    onChange={e => setBorrador(b => ({ ...b, cuerpo: e.target.value }))} />
                  <p className="text-[10.5px] text-gray-400 mt-1">
                    Texto normal. Una línea en blanco separa párrafos.
                  </p>
                </div>

                {actual.boton !== undefined && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                      Texto del botón
                    </label>
                    <input className="input py-1.5 text-xs max-w-xs" value={borrador.boton}
                      onChange={e => setBorrador(b => ({ ...b, boton: e.target.value }))} />
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Marcadores que puedes usar
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {actual.marcadores.map(m => (
                      <button key={m.k} onClick={() => insertarMarcador(m.k)}
                        title={`Se reemplaza por: ${m.ejemplo}`}
                        className="px-2 py-1 rounded-lg text-[10.5px] font-mono transition-colors"
                        style={{ backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                        {m.k}
                      </button>
                    ))}
                  </div>
                  {sueltos.length > 0 && (
                    <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: "#b91c1c" }}>
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      {sueltos.join(", ")} no existe{sueltos.length === 1 ? "" : "n"} en este correo:
                      saldría{sueltos.length === 1 ? "" : "n"} en blanco.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Vista previa: el correo de verdad, con ejemplos */}
            <div className="card overflow-hidden">
              <div className="card-header">
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                  <Eye size={13} className="text-gray-400" /> Así se ve
                </p>
                {previa && (
                  <p className="text-[11px] text-gray-400 truncate max-w-[50%]">
                    Asunto: <strong>{previa.asunto}</strong>
                  </p>
                )}
              </div>
              {previa ? (
                <iframe
                  title="Vista previa del correo"
                  srcDoc={previa.html}
                  className="w-full bg-white"
                  style={{ height: 620, border: 0 }}
                  sandbox=""
                />
              ) : (
                <div className="p-10 text-center text-[12px] text-gray-400">
                  <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                  Preparando la vista previa…
                </div>
              )}
              <p className="px-4 py-2.5 text-[10.5px] text-gray-400 border-t border-gray-100 dark:border-slate-700 flex items-center gap-1.5">
                <Check size={11} />
                Es el correo de verdad, armado por el servidor con el mismo código que lo envía.
                Los marcadores salen con datos de ejemplo.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
