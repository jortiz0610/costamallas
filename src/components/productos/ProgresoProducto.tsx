"use client";

// ============================================================
// Progreso de creación de un producto
//
// Solo aparece mientras el producto es nuevo o está incompleto. Muestra
// qué falta para poder publicarlo, con una barra que se llena y los pasos
// cambiando de color a medida que se completan.
//
// No bloquea nada: es una guía, no un asistente por pasos obligatorios.
// Quien ya conoce el formulario sigue trabajando como quiera.
// ============================================================

import { useMemo } from "react";
import { Check, Circle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasoProducto {
  id: string;
  titulo: string;
  /** Qué hay que hacer, en una frase. */
  ayuda: string;
  listo: boolean;
  /** Pestaña a la que salta al pulsarlo. */
  tab: string;
  /** Si es false, se puede publicar sin esto. */
  obligatorio: boolean;
}

/** Calcula los pasos a partir del estado actual del formulario. */
export function calcularPasos(form: Record<string, unknown>, imagenes: number): PasoProducto[] {
  const texto = (k: string) => String(form[k] ?? "").trim();
  const numero = (k: string) => Number(form[k] ?? 0);
  const lista = (k: string) => (Array.isArray(form[k]) ? (form[k] as unknown[]).length : 0);

  return [
    {
      id: "basicos",
      titulo: "Datos básicos",
      ayuda: "SKU y nombre del producto",
      listo: Boolean(texto("sku") && texto("nombre")),
      tab: "producto",
      obligatorio: true,
    },
    {
      id: "categoria",
      titulo: "Categoría",
      ayuda: "Al menos una, para que aparezca en la tienda",
      listo: lista("categorias") > 0,
      tab: "producto",
      obligatorio: true,
    },
    {
      id: "precio",
      titulo: "Precio",
      ayuda: "Precio normal en pesos",
      listo: numero("precioNormal") > 0,
      tab: "producto",
      obligatorio: true,
    },
    {
      id: "descripcion",
      titulo: "Descripción",
      ayuda: "Descripción corta para la ficha de venta",
      listo: Boolean(texto("descCorta") || texto("descripcion")),
      tab: "descripcion",
      obligatorio: true,
    },
    {
      id: "imagenes",
      titulo: "Imágenes",
      ayuda: "Al menos una foto del producto",
      listo: imagenes > 0,
      tab: "imagenes",
      obligatorio: true,
    },
    {
      id: "seo",
      titulo: "SEO",
      ayuda: "Meta título y descripción para Google",
      listo: Boolean(texto("seoTitulo") && texto("seoDescripcion")),
      tab: "seo",
      obligatorio: false,
    },
  ];
}

export function ProgresoProducto({
  pasos, onIrA, esNuevo,
}: { pasos: PasoProducto[]; onIrA: (tab: string) => void; esNuevo: boolean }) {
  const { hechos, totalObligatorios, obligatoriosHechos, porcentaje, completo } = useMemo(() => {
    const obligatorios = pasos.filter(p => p.obligatorio);
    const oh = obligatorios.filter(p => p.listo).length;
    const h = pasos.filter(p => p.listo).length;
    return {
      hechos: h,
      totalObligatorios: obligatorios.length,
      obligatoriosHechos: oh,
      porcentaje: Math.round((h / pasos.length) * 100),
      completo: oh === obligatorios.length,
    };
  }, [pasos]);

  // Una vez está todo lo obligatorio y el producto ya existe, la guía
  // estorba: se esconde sola.
  if (!esNuevo && completo) return null;

  const color = completo ? "#16a34a" : porcentaje >= 50 ? "#d97706" : "var(--brand-color)";

  return (
    <div className="card p-4 sm:p-5 mb-5 animate-fade-up">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ backgroundColor: color + "1a" }}
        >
          {completo
            ? <Check size={17} style={{ color }} />
            : <Sparkles size={17} style={{ color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {completo ? "Listo para publicar" : "Completa tu producto"}
          </p>
          <p className="text-[11px] text-muted">
            {completo
              ? `${hechos} de ${pasos.length} pasos · ya puedes publicarlo en la tienda`
              : `${obligatoriosHechos} de ${totalObligatorios} pasos obligatorios`}
          </p>
        </div>
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{porcentaje}%</span>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 rounded-full surface-2 overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${porcentaje}%`, backgroundColor: color }}
        />
      </div>

      {/* Pasos */}
      <div className="flex flex-wrap gap-1.5">
        {pasos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onIrA(p.tab)}
            title={p.ayuda}
            className={cn(
              "flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all",
              p.listo
                ? "text-white"
                : "surface-2 text-soft hover:brand-bg-10",
            )}
            style={{
              backgroundColor: p.listo ? "#16a34a" : undefined,
              // Escalonado: los pasos entran uno tras otro al aparecer.
              animationDelay: `${i * 40}ms`,
            }}
          >
            <span
              className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                p.listo ? "bg-white/25" : "",
              )}
            >
              {p.listo
                ? <Check size={10} className="text-white" />
                : <Circle size={9} className="text-gray-300" />}
            </span>
            {p.titulo}
            {!p.obligatorio && !p.listo && (
              <span className="text-[9px] font-normal opacity-60">opcional</span>
            )}
          </button>
        ))}
      </div>

      {!completo && (
        <p className="text-[11px] text-muted mt-3">
          Pulsa un paso para ir a su pestaña. Puedes guardar en cualquier momento;
          los pasos obligatorios son los que la tienda necesita para mostrar el producto.
        </p>
      )}
    </div>
  );
}
