"use client";

// ============================================================
// Retorno real por fuente: qué trae plata y qué trae ruido.
//
// El módulo de marketing mostraba un ROAS que nadie calculaba — los
// leads, las conversiones y los ingresos de cada campaña se teclean a
// mano. Esta pantalla no pregunta nada: sigue la cadena
// lead → cliente → cotizaciones → pedidos y suma lo que de verdad se
// cerró.
// ============================================================

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Loader2, ArrowLeft, TrendingUp, Users, DollarSign, Target, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";

const MKT_COLOR = "#db2777";

interface Fila {
  clave: string; fuente: string; campana: string | null;
  leads: number; cotizados: number; cerrados: number;
  valorCotizado: number; valorCerrado: number; tasaCierre: number; valorPorLead: number;
}
interface Retorno {
  ventanaDias: number;
  resumen: {
    leads: number; conCliente: number; cotizados: number; cerrados: number;
    valorCotizado: number; valorCerrado: number; tasaCierre: number;
  };
  filas: Fila[];
  sinRastro: number;
}

function Contenido() {
  const [dias, setDias] = useState(90);

  const { data, isLoading } = useQuery<Retorno>({
    queryKey: ["mkt-retorno", dias],
    queryFn: async () => (await (await fetch(`/api/marketing/retorno?dias=${dias}`)).json()).data,
  });

  if (isLoading || !data) {
    return (
      <>
        <Topbar title="Retorno real" />
        <div className="flex-1 flex items-center justify-center page-bg">
          <Loader2 size={20} className="animate-spin" style={{ color: MKT_COLOR }} />
        </div>
      </>
    );
  }

  const r = data.resumen;
  const maximo = Math.max(1, ...data.filas.map(f => f.valorCerrado));

  return (
    <>
      <Topbar title="Retorno real" actions={
        <div className="flex items-center gap-2">
          <select className="input py-1.5 text-xs w-auto" value={dias} onChange={e => setDias(Number(e.target.value))}>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={365}>Último año</option>
          </select>
          <Link href="/marketing" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Marketing</Link>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5">
        <div className="card p-4 flex items-start gap-3">
          <TrendingUp size={18} style={{ color: MKT_COLOR }} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">
            Esto no lo teclea nadie: sale de seguir cada lead de la web hasta sus cotizaciones y pedidos en el CRM.
            Las cifras de <Link href="/marketing/campanas" className="font-semibold hover:underline" style={{ color: MKT_COLOR }}>Campañas</Link>{" "}
            sí son manuales — la inversión hay que escribirla porque viene de la plataforma de anuncios, pero la plata
            cerrada ya no.
          </p>
        </div>

        {r.leads === 0 ? (
          <div className="card p-10 text-center">
            <Users size={26} className="mx-auto mb-3 text-muted" />
            <p className="text-sm font-semibold text-soft">Sin leads web en esta ventana</p>
            <p className="text-xs text-muted mt-2 max-w-md mx-auto leading-relaxed">
              Se llena solo con lo que entre por el formulario de la web (<code className="surface-3 px-1 rounded">/api/public/lead</code>),
              que ya guarda el origen UTM y crea la ficha en el CRM.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Leads web" valor={String(r.leads)} sub={`${r.conCliente} con ficha en el CRM`} color="#64748b" Icon={Users} />
              <Kpi label="Llegaron a cotizar" valor={String(r.cotizados)} sub={formatCOP(r.valorCotizado)} color="#185FA5" Icon={Target} />
              <Kpi label="Cerraron" valor={String(r.cerrados)} sub={`${r.tasaCierre}% de los leads`} color="#16a34a" Icon={TrendingUp} />
              <Kpi label="Plata cerrada" valor={formatCOP(r.valorCerrado)} sub="pedidos no cancelados" color={MKT_COLOR} Icon={DollarSign} />
            </div>

            {data.sinRastro > 0 && (
              <div className="card p-3.5 flex items-start gap-2 text-[11px]" style={{ borderLeft: "4px solid #f59e0b" }}>
                <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-muted">
                  {data.sinRastro} lead(s) sin ficha de cliente asociada: son anteriores a que se guardara el vínculo y
                  no se pueden seguir hasta la venta. No entran en el cálculo.
                </span>
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b divider">
                <p className="text-sm font-bold text-soft">Por fuente y campaña</p>
              </div>
              <div className="md:overflow-x-auto">
                <table className="table text-xs">
                  <thead>
                    <tr className="surface-2">
                      {["Fuente", "Leads", "Cotizaron", "Cerraron", "Tasa", "Plata cerrada", "Por lead"].map((h, i) => (
                        <th key={h} className={`px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px] ${i === 0 ? "text-left" : "text-right"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.filas.map(f => (
                      <tr key={f.clave} className="border-t divider">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-soft">{f.fuente}</p>
                          {f.campana && <p className="text-[10px] text-muted truncate max-w-[200px]">{f.campana}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-soft">{f.leads}</td>
                        <td className="px-4 py-2.5 text-right text-soft">{f.cotizados}</td>
                        <td className="px-4 py-2.5 text-right text-soft">{f.cerrados}</td>
                        <td className="px-4 py-2.5 text-right font-bold"
                          style={{ color: f.tasaCierre >= 20 ? "#16a34a" : f.tasaCierre > 0 ? "#d97706" : "var(--text-muted)" }}>
                          {f.tasaCierre}%
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 rounded-full overflow-hidden surface-3 w-16 hidden sm:block">
                              <div className="h-full rounded-full" style={{ width: `${(f.valorCerrado / maximo) * 100}%`, backgroundColor: MKT_COLOR }} />
                            </div>
                            <span className="font-bold text-soft whitespace-nowrap">{formatCOP(f.valorCerrado)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted whitespace-nowrap">{formatCOP(f.valorPorLead)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-muted">
              &quot;Por lead&quot; es la plata cerrada dividida entre los leads de esa fuente: es lo que vale traer uno más de
              ahí. Compáralo con lo que cuesta conseguirlo y ya tienes la decisión de dónde poner el presupuesto.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, valor, sub, color, Icon }: {
  label: string; valor: string; sub: string; color: string; Icon: typeof Users;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "18" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold truncate" style={{ color }}>{valor}</p>
        <p className="text-[10px] text-muted truncate">{sub}</p>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><Contenido /></Suspense>; }
