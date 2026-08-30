"use client";

// ============================================================
// "Para el cliente": lo que se hace con un producto cuando hay alguien
// esperando en el chat.
//
// Antes esto era una PANTALLA aparte que reemplazaba a la ficha del
// producto para quien no puede editar. Se cambió: el equipo comercial
// necesita ver el catálogo COMPLETO, no un resumen. Así que ahora la
// ficha entera se ve igual —con los campos apagados— y esto es una
// pestaña más: el texto listo para mandar, los enlaces y las existencias.
//
// Las existencias son lo único editable sin `erp.productos.editar`, y
// eso lo impone el servidor con una lista blanca de campos, no esta
// pantalla.
// ============================================================

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Copy, Check, Loader2, ExternalLink, Save, ImageOff, MessageCircle, Send,
} from "lucide-react";
import { formatCOP, formatNumber, nivelStock, stockLabel } from "@/lib/utils";
import { fichaParaCliente, urlEnTienda } from "@/lib/ficha-cliente";
import { EnviarANexus } from "@/components/nexus/EnviarANexus";
import { Ayuda } from "@/components/ui/Ayuda";
import type { NivelStock } from "@/types";

interface Imagen { id: string; urlImagen: string; altText: string | null; esPrincipal: boolean; posicion: number }

const COLOR_NIVEL: Record<NivelStock, string> = {
  OK: "#16a34a",
  ADVERTENCIA: "#ca8a04",
  BAJO: "#ea580c",
  CRITICO: "#dc2626",
};

export function ParaElCliente({
  productoId,
  form,
  puedeEditar,
}: {
  productoId?: string;
  form: Record<string, unknown>;
  puedeEditar: boolean;
}) {
  const qc = useQueryClient();
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aNexus, setANexus] = useState<{ contenido: string; tipo: "texto" | "imagen" } | null>(null);
  const [stock, setStock] = useState(String(form.stock ?? 0));
  const [guardando, setGuardando] = useState(false);

  const { data: imagenes = [] } = useQuery<Imagen[]>({
    queryKey: ["imagenes", productoId],
    queryFn: async () => (await (await fetch(`/api/imagenes?productoId=${productoId}`)).json()).data ?? [],
    enabled: Boolean(productoId),
  });

  const p = form as {
    nombre?: string; sku?: string; descCorta?: string;
    precioNormal?: number | string | null; precioOferta?: number | string | null;
    acfUnidadVenta?: string; acfColores?: string[]; acfGarantiaAnos?: number | string | null;
    acfFabricacionMedida?: boolean; acfInstalacion?: boolean;
    largoCm?: number | string | null; anchoCm?: number | string | null; altoCm?: number | string | null;
    wcId?: number | null; stockMinimo?: number | string; acfFichaTecnicaPdf?: string;
  };

  const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

  const datos = useMemo(() => ({
    nombre: p.nombre, sku: p.sku, descCorta: p.descCorta,
    precioNormal: num(p.precioNormal), precioOferta: num(p.precioOferta),
    acfUnidadVenta: p.acfUnidadVenta, acfColores: p.acfColores,
    acfGarantiaAnos: num(p.acfGarantiaAnos),
    acfFabricacionMedida: p.acfFabricacionMedida, acfInstalacion: p.acfInstalacion,
    largoCm: num(p.largoCm), anchoCm: num(p.anchoCm), altoCm: num(p.altoCm),
    wcId: p.wcId ?? null,
  }), [form]); // eslint-disable-line react-hooks/exhaustive-deps

  const texto = useMemo(() => fichaParaCliente(datos), [datos]);
  const urlTienda = urlEnTienda(datos);
  const nivel = nivelStock(Number(form.stock ?? 0), Number(p.stockMinimo ?? 15));

  const copiar = async (valor: string, etiqueta: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(etiqueta);
      toast.success(`${etiqueta} copiado`);
      setTimeout(() => setCopiado(null), 1800);
    } catch { toast.error("El navegador no dejó copiar"); }
  };

  const guardarStock = async () => {
    const valor = parseInt(stock, 10);
    if (Number.isNaN(valor) || valor < 0) return toast.error("El stock tiene que ser un número de 0 en adelante");
    setGuardando(true);
    try {
      // Solo el stock: es lo que el servidor deja pasar sin el permiso de
      // editar productos, y mandar el resto haría que rechazara todo.
      const res = await fetch(`/api/productos/${productoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: valor, enStock: valor > 0 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo guardar");
      toast.success("Existencias actualizadas");
      qc.invalidateQueries({ queryKey: ["producto", productoId] });
      qc.invalidateQueries({ queryKey: ["productos"] });
    } catch { toast.error("Error de conexión"); }
    finally { setGuardando(false); }
  };

  const cambioDeStock = String(form.stock ?? 0) !== stock;

  /** Todas las fotos, una debajo de otra, listas para pegar. */
  const todasLasUrls = imagenes.map(i => i.urlImagen).join("\n");

  if (!productoId) {
    return (
      <div className="max-w-3xl mx-auto card p-10 text-center">
        <p className="text-sm font-semibold text-gray-500">Guarda el producto primero</p>
        <p className="text-xs text-gray-400 mt-1">
          Hace falta que exista para poder armar lo que se le manda al cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Existencias */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">Existencias</p>
          <Ayuda titulo="Existencias">
            {puedeEditar
              ? "Cuántas unidades hay. El mínimo configurado dispara la alerta de stock bajo."
              : "Es lo único del catálogo que puedes corregir. Ajústalo cuando entre o salga material."}
          </Ayuda>
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: COLOR_NIVEL[nivel] + "1a", color: COLOR_NIVEL[nivel] }}
          >
            {stockLabel(nivel)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" min={0} className="input flex-1 max-w-[160px]"
            value={stock} onChange={e => setStock(e.target.value)} />
          <button onClick={guardarStock} disabled={!cambioDeStock || guardando}
            className="btn-primary btn-sm disabled:opacity-40">
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar
          </button>
          <span className="text-[10.5px] text-gray-400">
            Mínimo {formatNumber(Number(p.stockMinimo ?? 15))}
            {p.acfUnidadVenta ? ` ${p.acfUnidadVenta}` : ""}
          </span>
        </div>
      </div>

      {/* El mensaje */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">El mensaje</p>
          <Ayuda titulo="Qué sale aquí">
            Solo lo que está cargado en el catálogo. Si falta el precio o la medida, no
            aparece esa línea: es mejor que mandarle al cliente un dato inventado.
          </Ayuda>
        </div>
        <pre className="text-[11.5px] whitespace-pre-wrap bg-gray-50 dark:bg-slate-800 rounded-xl p-3 text-gray-700 dark:text-slate-300 max-h-56 overflow-y-auto">
          {texto}
        </pre>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => copiar(texto, "Mensaje")} className="btn-primary btn-sm">
            {copiado === "Mensaje" ? <Check size={13} /> : <Copy size={13} />} Copiar
          </button>
          <button onClick={() => setANexus({ contenido: texto, tipo: "texto" })} className="btn-secondary btn-sm">
            <Send size={13} /> A un chat
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
            <MessageCircle size={13} /> WhatsApp
          </a>
          {urlTienda && (
            <>
              <button onClick={() => copiar(urlTienda, "Enlace")} className="btn-secondary btn-sm">
                {copiado === "Enlace" ? <Check size={13} /> : <Copy size={13} />} Enlace de la tienda
              </button>
              <a href={urlTienda} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                <ExternalLink size={13} /> Abrir
              </a>
            </>
          )}
          {p.acfFichaTecnicaPdf && (
            <a href={p.acfFichaTecnicaPdf} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              <ExternalLink size={13} /> Ficha técnica
            </a>
          )}
        </div>
      </div>

      {/* Las fotos */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">
            Las fotos {imagenes.length > 0 && <span className="text-gray-400 font-normal">({imagenes.length})</span>}
          </p>
          <Ayuda titulo="Mandar fotos">
            Puedes mandar una sola o todas de golpe. Al chat van como enlaces, que es lo
            que WhatsApp convierte en vista previa.
          </Ayuda>
          {imagenes.length > 1 && (
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button onClick={() => copiar(todasLasUrls, "Enlaces")} className="btn-secondary btn-sm">
                {copiado === "Enlaces" ? <Check size={12} /> : <Copy size={12} />} Copiar todas
              </button>
              <button
                onClick={() => setANexus({ contenido: todasLasUrls, tipo: "texto" })}
                className="btn-secondary btn-sm"
                title="Mandar todas las fotos del producto a un chat"
              >
                <Send size={12} /> Mandar todas
              </button>
            </div>
          )}
        </div>

        {imagenes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-gray-300">
            <ImageOff size={26} />
            <span className="text-[11.5px]">Este producto todavía no tiene fotos</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {imagenes.map(img => (
              <div key={img.id} className="group relative rounded-xl overflow-hidden border divider">
                <img src={img.urlImagen} alt={img.altText ?? ""} className="w-full aspect-square object-cover" />
                {img.esPrincipal && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400 text-white">
                    Principal
                  </span>
                )}
                <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => copiar(img.urlImagen, "Foto")}
                    title="Copiar el enlace de esta foto"
                    className="w-9 h-9 rounded-xl bg-white/90 text-gray-700 flex items-center justify-center">
                    <Copy size={15} />
                  </button>
                  <button onClick={() => setANexus({ contenido: img.urlImagen, tipo: "imagen" })}
                    title="Mandar esta foto a un chat"
                    className="w-9 h-9 rounded-xl bg-violet-500 text-white flex items-center justify-center">
                    <Send size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Precio, de un vistazo */}
      <div className="card p-4 sm:p-5 flex items-baseline gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Precio</span>
        {num(p.precioOferta) ?? num(p.precioNormal) ? (
          <>
            <span className="text-[22px] font-bold" style={{ color: "var(--brand-color)" }}>
              {formatCOP((num(p.precioOferta) ?? num(p.precioNormal))!)}
            </span>
            {p.acfUnidadVenta && <span className="text-[12px] text-gray-400">por {p.acfUnidadVenta}</span>}
          </>
        ) : (
          <span className="text-[13px] font-semibold text-amber-600">
            Sin precio cargado — no se puede cotizar todavía
          </span>
        )}
      </div>

      {aNexus && (
        <EnviarANexus
          contenido={aNexus.contenido}
          tipo={aNexus.tipo}
          titulo="Mandar a un chat"
          onClose={() => setANexus(null)}
        />
      )}
    </div>
  );
}
