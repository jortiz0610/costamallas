"use client";

// ============================================================
// La ficha del producto para quien NO puede editar el catálogo.
//
// No es el formulario con los campos apagados: es otra pantalla. Un
// formulario deshabilitado sigue estando organizado para quien carga
// datos —SKU interno, backorders, clase de impuesto— y esconde debajo
// lo único que el vendedor necesita a mano: cuánto vale, cuánto hay y
// qué le mando al cliente.
//
// Lo único editable es el STOCK, porque es lo que el vendedor corrige
// cuando descarga mercancía. Eso lo impone el servidor con una lista
// blanca de campos (`api/productos/[id]`), no esta pantalla.
// ============================================================

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Copy, Check, Loader2, Package, ExternalLink, Save, ImageOff,
  MessageCircle, Ruler, ShieldCheck, Palette, Tag as TagIcon, Info,
} from "lucide-react";
import { formatCOP, formatNumber, nivelStock, stockLabel } from "@/lib/utils";
import { fichaParaCliente, medidasLegibles, urlEnTienda } from "@/lib/ficha-cliente";
import type { NivelStock } from "@/types";

interface Imagen { id: string; urlImagen: string; altText: string | null; esPrincipal: boolean; posicion: number }

interface Props {
  productoId: string;
  producto: Record<string, unknown>;
}

const COLOR_NIVEL: Record<NivelStock, string> = {
  OK: "#16a34a",
  ADVERTENCIA: "#ca8a04",
  BAJO: "#ea580c",
  CRITICO: "#dc2626",
};

/** Copiar al portapapeles con aviso, y sin romperse si el navegador dice que no. */
function useCopiar() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (texto: string, etiqueta: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      toast.success(`${etiqueta} copiado`);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      toast.error("El navegador no dejó copiar. Selecciona el texto a mano.");
    }
  };
  return { copiar, copiado };
}

function Dato({ icono, label, valor }: { icono: React.ReactNode; label: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === "" ) return null;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="text-gray-300 dark:text-slate-600 mt-0.5 flex-shrink-0">{icono}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide font-bold text-gray-400 dark:text-slate-500">{label}</p>
        <p className="text-[12.5px] text-gray-800 dark:text-gray-100">{valor}</p>
      </div>
    </div>
  );
}

export function FichaVendedor({ productoId, producto }: Props) {
  const qc = useQueryClient();
  const { copiar, copiado } = useCopiar();

  const [stock, setStock] = useState<string>(String(producto.stock ?? 0));
  const [guardando, setGuardando] = useState(false);

  const { data: imagenes = [] } = useQuery<Imagen[]>({
    queryKey: ["imagenes", productoId],
    queryFn: async () => (await (await fetch(`/api/imagenes?productoId=${productoId}`)).json()).data ?? [],
  });

  const principal = imagenes.find(i => i.esPrincipal) ?? imagenes[0] ?? null;

  const p = producto as {
    nombre?: string; sku?: string; acfSkuInterno?: string;
    precioNormal?: number | null; precioOferta?: number | null;
    stock?: number; stockMinimo?: number; enStock?: boolean;
    categorias?: string[]; acfColores?: string[]; acfAplicaciones?: string[];
    acfUnidadVenta?: string; acfMarcaFabricante?: string; acfGarantiaAnos?: number | null;
    largoCm?: number | null; anchoCm?: number | null; altoCm?: number | null; pesoKg?: number | null;
    acfFabricacionMedida?: boolean; acfInstalacion?: boolean;
    descCorta?: string; publicado?: boolean; wcId?: number | null;
    acfFichaTecnicaPdf?: string;
  };

  const precio = p.precioOferta ?? p.precioNormal ?? null;
  const nivel = nivelStock(Number(producto.stock ?? 0), Number(p.stockMinimo ?? 15));
  const urlTienda = urlEnTienda(p);

  const medidas = medidasLegibles(p);

  // El texto sale de lib/ficha-cliente.ts, que es el mismo que usa el
  // listado del catálogo: si cada pantalla lo armara por su cuenta, tarde
  // o temprano una mandaría un precio viejo.
  const textoParaCliente = useMemo(() => fichaParaCliente(p), [p]);

  const guardarStock = async () => {
    const valor = parseInt(stock, 10);
    if (Number.isNaN(valor) || valor < 0) return toast.error("El stock tiene que ser un número de 0 en adelante");
    setGuardando(true);
    try {
      // Se manda SOLO el stock. Es lo que el servidor deja pasar sin el
      // permiso de editar productos, y mandar el resto haría que la
      // petición entera fuera rechazada.
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
    } catch {
      toast.error("Error de conexión");
    } finally {
      setGuardando(false);
    }
  };

  const cambioDeStock = String(producto.stock ?? 0) !== stock;

  return (
    <div className="flex-1 overflow-y-auto page-bg p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Por qué esta pantalla se ve distinta */}
        <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[11.5px] text-blue-800 dark:text-blue-300">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <p>
            Estás viendo la ficha comercial. Los datos del catálogo son de solo lectura;
            lo único que puedes corregir aquí son las <strong>existencias</strong>.
            Si necesitas editar el producto completo, pídele el permiso a un administrador.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

          {/* Foto y existencias */}
          <div className="space-y-4">
            <div className="card overflow-hidden">
              {principal ? (
                <img
                  src={principal.urlImagen}
                  alt={principal.altText ?? p.nombre ?? ""}
                  className="w-full aspect-square object-cover bg-gray-50 dark:bg-slate-800"
                />
              ) : (
                <div className="w-full aspect-square flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-slate-800 text-gray-300">
                  <ImageOff size={28} />
                  <span className="text-[11px]">Sin foto cargada</span>
                </div>
              )}
              {imagenes.length > 1 && (
                <div className="flex gap-1.5 p-2 overflow-x-auto">
                  {imagenes.slice(0, 8).map(img => (
                    <img key={img.id} src={img.urlImagen} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ))}
                </div>
              )}
              {principal && (
                <button
                  onClick={() => copiar(principal.urlImagen, "Enlace de la foto")}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-[11.5px] text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-t border-gray-100 dark:border-slate-700"
                >
                  {copiado === "Enlace de la foto" ? <Check size={12} /> : <Copy size={12} />} Copiar enlace de la foto
                </button>
              )}
            </div>

            {/* Existencias: lo único editable */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Existencias</p>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: COLOR_NIVEL[nivel] + "1a", color: COLOR_NIVEL[nivel] }}
                >
                  {stockLabel(nivel)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  className="input flex-1"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                />
                <button
                  onClick={guardarStock}
                  disabled={!cambioDeStock || guardando}
                  className="btn-primary btn-sm disabled:opacity-40"
                >
                  {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Guardar
                </button>
              </div>
              <p className="text-[10.5px] text-gray-400 mt-2">
                Mínimo configurado: {formatNumber(Number(p.stockMinimo ?? 15))}
                {p.acfUnidadVenta ? ` ${p.acfUnidadVenta}` : ""}.
              </p>
            </div>
          </div>

          {/* Datos y herramientas */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-[18px] font-bold text-gray-900 dark:text-gray-50 leading-tight">{p.nombre}</h1>
                  <button
                    onClick={() => copiar(p.sku ?? "", "SKU")}
                    className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-mono text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    title="Copiar la referencia"
                  >
                    {p.sku}
                    {copiado === "SKU" ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
                {p.publicado
                  ? <span className="badge-green flex-shrink-0">En la tienda</span>
                  : <span className="badge-gray flex-shrink-0">No publicado</span>}
              </div>

              <div className="mt-4 flex items-baseline gap-3 flex-wrap">
                {precio != null ? (
                  <>
                    <span className="text-[26px] font-bold" style={{ color: "var(--brand-color)" }}>
                      {formatCOP(precio)}
                    </span>
                    {p.acfUnidadVenta && (
                      <span className="text-[12px] text-gray-400">por {p.acfUnidadVenta}</span>
                    )}
                    {p.precioOferta != null && p.precioNormal != null && p.precioOferta < p.precioNormal && (
                      <span className="text-[13px] text-gray-400 line-through">{formatCOP(p.precioNormal)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[13px] font-semibold text-amber-600">
                    Sin precio cargado — no se puede cotizar todavía
                  </span>
                )}
              </div>

              {p.descCorta && (
                <p className="text-[12.5px] text-gray-600 dark:text-slate-300 mt-3 leading-relaxed">
                  {String(p.descCorta).replace(/<[^>]*>/g, "")}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                <Dato icono={<TagIcon size={13} />} label="Categorías" valor={p.categorias?.length ? p.categorias.join(", ") : null} />
                <Dato icono={<Package size={13} />} label="Marca" valor={p.acfMarcaFabricante || null} />
                <Dato icono={<Ruler size={13} />} label="Medidas (largo × ancho × alto)" valor={medidas} />
                <Dato icono={<Package size={13} />} label="Peso" valor={p.pesoKg ? `${p.pesoKg} kg` : null} />
                <Dato icono={<Palette size={13} />} label="Colores" valor={p.acfColores?.length ? p.acfColores.join(", ") : null} />
                <Dato icono={<ShieldCheck size={13} />} label="Garantía" valor={p.acfGarantiaAnos ? `${p.acfGarantiaAnos} año${p.acfGarantiaAnos > 1 ? "s" : ""}` : null} />
                <Dato icono={<Ruler size={13} />} label="Fabricación a medida" valor={p.acfFabricacionMedida ? "Sí" : null} />
                <Dato icono={<Package size={13} />} label="Instalación" valor={p.acfInstalacion ? "Disponible" : null} />
                <Dato icono={<Package size={13} />} label="Aplicaciones" valor={p.acfAplicaciones?.length ? p.acfAplicaciones.join(", ") : null} />
              </div>
            </div>

            {/* Para mandarle al cliente */}
            <div className="card p-5">
              <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 mb-1">
                Para mandarle al cliente
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                Solo sale lo que está cargado en el catálogo. Si falta el precio o la medida,
                no aparece la línea: es mejor que mandarle un dato inventado.
              </p>
              <pre className="text-[11.5px] whitespace-pre-wrap bg-gray-50 dark:bg-slate-800 rounded-xl p-3 text-gray-700 dark:text-slate-300 max-h-60 overflow-y-auto">
                {textoParaCliente}
              </pre>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => copiar(textoParaCliente, "Ficha")} className="btn-primary btn-sm">
                  {copiado === "Ficha" ? <Check size={13} /> : <Copy size={13} />} Copiar la ficha
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(textoParaCliente)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary btn-sm"
                >
                  <MessageCircle size={13} /> Enviar por WhatsApp
                </a>
                {urlTienda && (
                  <>
                    <button onClick={() => copiar(urlTienda, "Enlace de la tienda")} className="btn-secondary btn-sm">
                      {copiado === "Enlace de la tienda" ? <Check size={13} /> : <Copy size={13} />} Copiar el enlace
                    </button>
                    <a href={urlTienda} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                      <ExternalLink size={13} /> Abrir en la tienda
                    </a>
                  </>
                )}
                {p.acfFichaTecnicaPdf && (
                  <a href={p.acfFichaTecnicaPdf} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                    <ExternalLink size={13} /> Ficha técnica (PDF)
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
