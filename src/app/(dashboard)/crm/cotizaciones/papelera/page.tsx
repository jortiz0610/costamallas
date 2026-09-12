"use client";

// ============================================================
// La papelera de cotizaciones.
//
// El borrado ya existía y funcionaba —marca la oferta, libera el número
// y deja constancia de quién y por qué—, pero no había forma de VERLO.
// Una papelera que solo se puede consultar con una llamada a la API es,
// en la práctica, un borrado definitivo: nadie iba a recuperar nada.
//
// Es solo para administración, igual que borrar. El servidor lo vuelve a
// comprobar; esconder el enlace no protege nada por sí solo.
//
// Lo que se muestra está elegido para responder a "¿qué pasó con la
// COT-12118?": el número que TENÍA, quién la borró, cuándo y por qué.
// El número actual es un centinela interno (BORRADA-<id>) y no se
// enseña: no significa nada para quien mira.
// ============================================================

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Trash2, RotateCcw, Loader2, ArrowLeft, ShieldAlert, FileText,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { formatCOP } from "@/lib/utils";
import { formatFechaCO } from "@/lib/timezone";
import toast from "react-hot-toast";

const CRM_COLOR = "#BA7517";

interface Borrada {
  id: string;
  numero: string;
  numeroOriginal?: string | null;
  estado: string;
  total: number;
  createdAt: string;
  borradaEn?: string | null;
  borradaMotivo?: string | null;
  borradaPor?: { nombre: string } | null;
  cliente: { nombre: string; empresa?: string | null };
  vendedor?: { nombre: string } | null;
  _count: { items: number };
}

// La fecha se pinta en hora de Colombia. Sin fijar la zona, una oferta
// borrada a las 8 de la noche -que en UTC ya es el dia siguiente- se
// mostraba con la fecha de mañana.
const fecha = formatFechaCO;

function PapeleraContent() {
  const { isAdmin, isLoading: cargandoSesion } = useAuth();
  const qc = useQueryClient();
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cotizaciones-borradas"],
    queryFn: async () =>
      (await (await fetch("/api/crm/cotizaciones?borradas=1")).json()),
    enabled: isAdmin,
  });

  const borradas: Borrada[] = data?.data ?? [];

  const restaurar = async (c: Borrada) => {
    const nombre = c.numeroOriginal ?? "esta cotización";
    if (!confirm(
      `Se devuelve ${nombre} a la lista de cotizaciones.\n\n`
      + "Si su número ya lo tomó otra oferta, se restaura con uno nuevo.\n\n¿Sigo?",
    )) return;

    setRestaurando(c.id);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${c.id}?restaurar=1`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "No se pudo restaurar");
        return;
      }
      // Se avisa del cambio de número porque es justo lo que descuadra
      // un archivo contable si nadie se entera: la oferta vuelve, pero
      // con otro consecutivo del que hay que dejar rastro.
      if (json.numeroCambiado) {
        toast.success(
          `Restaurada como ${json.numero}. Su número anterior (${c.numeroOriginal}) ya estaba tomado.`,
          { duration: 9000 },
        );
      } else {
        toast.success(`${json.numero} volvió a la lista`);
      }
      qc.invalidateQueries({ queryKey: ["cotizaciones-borradas"] });
      qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] });
    } catch {
      toast.error("Error de conexión");
    } finally {
      setRestaurando(null);
    }
  };

  // Mientras se sabe quién eres no se decide nada: pintar el aviso de
  // "no tienes permiso" durante medio segundo a un administrador es
  // peor que no pintar nada.
  if (cargandoSesion) {
    return (
      <>
        <Topbar title="Cotizaciones borradas" />
        <div className="flex-1 page-bg p-6 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Topbar title="Cotizaciones borradas" />
        <div className="flex-1 page-bg p-6">
          <div className="card p-8 max-w-md mx-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: "#fef3c7" }}>
              <ShieldAlert size={22} style={{ color: "#b45309" }} />
            </div>
            <p className="text-base font-semibold text-soft">Esto lo ve solo un administrador</p>
            <p className="text-sm text-muted">
              Una oferta borrada salió del embudo y de las cifras del mes. Quién puede verla
              es la misma pregunta que quién puede borrarla.
            </p>
            <Link href="/crm/cotizaciones" className="btn-secondary btn-sm inline-flex">
              <ArrowLeft size={13} /> Volver a cotizaciones
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Cotizaciones borradas"
        actions={
          <Link href="/crm/cotizaciones" className="btn-secondary btn-sm">
            <ArrowLeft size={13} /> <span className="hidden sm:inline">Cotizaciones</span>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto page-bg p-3 sm:p-5 space-y-4">
        {/* Qué es esto, dicho una vez y sin rodeos. La regla del número
            no es evidente y es la que genera las preguntas. */}
        <div className="card p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: CRM_COLOR + "18" }}>
            <Trash2 size={16} style={{ color: CRM_COLOR }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-soft">
              {borradas.length === 0
                ? "No hay cotizaciones borradas"
                : `${borradas.length} cotización${borradas.length === 1 ? "" : "es"} borrada${borradas.length === 1 ? "" : "s"}`}
            </p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              No se borran de verdad: se guardan aquí con su número, su fecha y quién las borró.
              Al restaurar, si su número ya lo tomó otra oferta se le da uno nuevo — un consecutivo
              no se puede repetir.
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted">Cargando…</div>
          ) : borradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <FileText size={28} className="text-muted" />
              <p className="text-sm font-medium text-soft">La papelera está vacía</p>
              <p className="text-xs text-muted max-w-xs">
                Cuando un administrador borre una cotización, aparecerá aquí y se podrá recuperar.
              </p>
            </div>
          ) : (
            borradas.map(c => (
              /* Se apila hasta `xl`, igual que la lista de cotizaciones:
                 en el teléfono, el motivo del borrado es texto libre y
                 en una sola línea estrujaba todo lo demás. */
              <div key={c.id}
                className="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4 px-4 xl:px-5 py-3.5 border-b border-gray-50 dark:border-gray-800 last:border-b-0">
                <div className="flex items-center justify-between gap-3 xl:block xl:flex-shrink-0 xl:w-36">
                  <div className="min-w-0">
                    {/* El número que TENÍA. Tachado, porque ahora mismo
                        ese número está libre y puede ser de otra. */}
                    <p className="text-xs font-mono font-bold text-gray-500 line-through">
                      {c.numeroOriginal ?? "sin número"}
                    </p>
                    <p className="text-[10px] text-gray-400">creada {fecha(c.createdAt)}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: "#fee2e2", color: "#b91c1c" }}>
                    Borrada
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {c.cliente.empresa || c.cliente.nombre}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Borrada por {c.borradaPor?.nombre ?? "alguien que ya no está"} · {fecha(c.borradaEn)}
                    {c.vendedor?.nombre ? ` · la hizo ${c.vendedor.nombre}` : ""}
                  </p>
                  {/* El motivo es lo que convierte la papelera en algo
                      útil dentro de tres meses. Si no lo pusieron, se
                      dice, en vez de dejar un hueco. */}
                  <p className="text-[11px] mt-1 italic text-muted">
                    {c.borradaMotivo ? `«${c.borradaMotivo}»` : "Sin motivo anotado"}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 xl:contents">
                  <p className="text-base xl:text-sm font-bold text-gray-900 dark:text-gray-100 xl:w-32 text-right">
                    {formatCOP(c.total)}
                  </p>
                  <button
                    onClick={() => restaurar(c)}
                    disabled={restaurando === c.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-white disabled:opacity-50 flex-shrink-0"
                    style={{ backgroundColor: CRM_COLOR }}
                  >
                    {restaurando === c.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <RotateCcw size={12} />}
                    Restaurar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function PapeleraPage() {
  return <Suspense><PapeleraContent /></Suspense>;
}
