"use client";

// ============================================================
// La tercera columna del inbox: con quién estoy hablando.
//
// En escritorio el inbox eran dos columnas —lista de 320 px y chat— y en
// una pantalla ancha eso deja media pantalla en blanco con una cinta de
// burbujas a la izquierda. Se veía vacío porque LO ESTABA.
//
// Esta columna no es relleno: es lo que hay que saber ANTES de contestar.
// Quién es, si ya compró, cuánto, qué le cotizamos y si sigue vivo. Hoy
// eso obliga a abrir el CRM en otra pestaña y perder el hilo.
//
// Solo aparece a partir de 1280 px. Por debajo, el chat se queda con
// todo el ancho, que es lo correcto en un portátil.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  UserCircle, Building2, Phone, Mail, MapPin, ClipboardList, ShoppingCart,
  Loader2, UserPlus, ExternalLink, Tag, Clock,
} from "lucide-react";
import { formatCOP, timeAgo } from "@/lib/utils";
import { metaEstado } from "@/lib/estados-cliente";

interface Props {
  conv: {
    id: string;
    canal: string;
    remitente: string;
    telRemit?: string | null;
    emailRemit?: string | null;
    etiquetas?: string[];
    cliente?: { id: string; nombre: string; empresa?: string | null } | null;
  };
  onGuardarCliente: () => void;
  guardando: boolean;
}

interface FichaCliente {
  id: string; nombre: string; empresa?: string | null; email?: string | null;
  telefono?: string | null; ciudad?: string | null; tipo: string; estado: string;
  ultimaInteraccionEn?: string | null;
  _count: { cotizaciones: number; pedidos: number };
}

interface Movimiento { id: string; numero: string; estado: string; total: number; createdAt: string }

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 border-b divider last:border-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">{titulo}</p>
      {children}
    </div>
  );
}

function Dato({ Icon, children }: { Icon: React.ElementType; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[12px] text-soft py-0.5 min-w-0">
      <Icon size={12} className="text-muted flex-shrink-0" />
      <span className="truncate">{children}</span>
    </p>
  );
}

/**
 * Etiquetas que dicen cómo llegó la conversación, escritas para leerse.
 *
 * En la base se guardan en clave —así se pueden filtrar— pero
 * "escalada-por-agente" no es una frase; es un identificador que se coló
 * a la pantalla.
 */
const NOMBRE_DE_PROCESO: Record<string, string> = {
  "escalada-por-agente": "El asistente la pasó a una persona",
  "sesion-web": "Escribió desde el chat de la página",
  "ya-es-cliente": "Ya era cliente cuando escribió",
};
const CLAVES_DE_PROCESO = Object.keys(NOMBRE_DE_PROCESO);

export function PanelContexto({ conv, onGuardarCliente, guardando }: Props) {
  const clienteId = conv.cliente?.id;
  const todas = conv.etiquetas ?? [];
  const etiquetasDeProceso = todas.filter(e => CLAVES_DE_PROCESO.includes(e));
  const etiquetasDeTema = todas.filter(e => !CLAVES_DE_PROCESO.includes(e));

  const { data: ficha, isLoading } = useQuery<FichaCliente | null>({
    queryKey: ["crm-cliente", clienteId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/clientes/${clienteId}`);
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: Boolean(clienteId),
  });

  const { data: cotizaciones = [] } = useQuery<Movimiento[]>({
    queryKey: ["crm-cliente-cotizaciones", clienteId],
    queryFn: async () =>
      (await (await fetch(`/api/crm/cotizaciones?clienteId=${clienteId}`)).json()).data ?? [],
    enabled: Boolean(clienteId),
  });

  return (
    <aside className="hidden xl:flex xl:w-[300px] flex-shrink-0 flex-col surface overflow-y-auto"
      style={{ borderLeft: "1px solid var(--border)" }}>

      {/* Quién escribe */}
      <Bloque titulo="Quién escribe">
        <p className="text-[13.5px] font-semibold text-gray-800 dark:text-gray-100 truncate">
          {conv.cliente?.empresa || conv.cliente?.nombre || conv.remitente}
        </p>
        <div className="mt-1.5 space-y-0">
          {conv.telRemit && <Dato Icon={Phone}>{conv.telRemit}</Dato>}
          {conv.emailRemit && <Dato Icon={Mail}>{conv.emailRemit}</Dato>}
          {ficha?.ciudad && <Dato Icon={MapPin}>{ficha.ciudad}</Dato>}
        </div>

        {!clienteId && (
          <button
            onClick={onGuardarCliente}
            disabled={guardando}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-color-10)", color: "var(--brand-color)" }}
          >
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            Guardar en el CRM
          </button>
        )}
      </Bloque>

      {/* Las etiquetas, en dos grupos.
          Antes iban todas juntas —y también en cada fila de la bandeja—,
          así que "escalada-por-agente" salía repetida en media pantalla y
          tapaba lo que sí ayuda a decidir: el producto y la ciudad.
          Aquí se separan: lo que el bot dedujo de LO QUE SE HABLÓ, y
          aparte cómo llegó la conversación. */}
      {etiquetasDeTema.length > 0 && (
        <Bloque titulo="De la conversación">
          <div className="flex flex-wrap gap-1">
            {etiquetasDeTema.map((e, i) => {
              const urgente = e === "urgencia:alta";
              return (
                <span key={i}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={urgente
                    ? { backgroundColor: "#dc2626", color: "white" }
                    : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {!urgente && <Tag size={9} />}
                  {urgente ? "URGENTE" : e}
                </span>
              );
            })}
          </div>
        </Bloque>
      )}

      {etiquetasDeProceso.length > 0 && (
        <Bloque titulo="Cómo llegó">
          <div className="flex flex-col gap-1.5">
            {etiquetasDeProceso.map((e, i) => (
              <span key={i} className="flex items-start gap-1.5 text-[11px] text-muted leading-snug">
                <Tag size={10} className="flex-shrink-0 mt-0.5" />
                {NOMBRE_DE_PROCESO[e] ?? e}
              </span>
            ))}
          </div>
        </Bloque>
      )}

      {/* Su historia con nosotros */}
      {clienteId && (
        <>
          <Bloque titulo="En el CRM">
            {isLoading || !ficha ? (
              <Loader2 size={14} className="animate-spin text-muted" />
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: metaEstado(ficha.estado).bg, color: metaEstado(ficha.estado).text }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: metaEstado(ficha.estado).dot }} />
                    {metaEstado(ficha.estado).l}
                  </span>
                  <span className="text-[10.5px] text-muted inline-flex items-center gap-1">
                    {ficha.tipo === "empresa" ? <Building2 size={10} /> : <UserCircle size={10} />}
                    {ficha.tipo === "empresa" ? "Empresa" : "Persona"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded-lg px-2.5 py-2 surface-2">
                    <p className="text-[10px] text-muted flex items-center gap-1"><ClipboardList size={10} /> Cotizaciones</p>
                    <p className="text-[15px] font-bold text-gray-800 dark:text-gray-100">{ficha._count.cotizaciones}</p>
                  </div>
                  <div className="rounded-lg px-2.5 py-2 surface-2">
                    <p className="text-[10px] text-muted flex items-center gap-1"><ShoppingCart size={10} /> Pedidos</p>
                    <p className="text-[15px] font-bold text-gray-800 dark:text-gray-100">{ficha._count.pedidos}</p>
                  </div>
                </div>

                {ficha.ultimaInteraccionEn && (
                  <p className="mt-2.5 text-[10.5px] text-muted flex items-center gap-1.5">
                    <Clock size={10} /> Última señal {timeAgo(ficha.ultimaInteraccionEn)}
                  </p>
                )}

                <Link href={`/crm/clientes/${ficha.id}`}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold surface-2 text-soft hover:opacity-80 transition-opacity">
                  Abrir la ficha <ExternalLink size={11} />
                </Link>
              </>
            )}
          </Bloque>

          {cotizaciones.length > 0 && (
            <Bloque titulo={`Sus ofertas (${cotizaciones.length})`}>
              <div className="space-y-1">
                {cotizaciones.slice(0, 5).map(c => (
                  <Link key={c.id} href={`/crm/cotizaciones/${c.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:surface-2 transition-colors">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-medium text-gray-800 dark:text-gray-100 truncate">
                        {c.numero}
                      </span>
                      <span className="block text-[10px] text-muted">{c.estado.toLowerCase()}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-soft flex-shrink-0">
                      {formatCOP(Number(c.total))}
                    </span>
                  </Link>
                ))}
              </div>
            </Bloque>
          )}

          <Bloque titulo="Atajos">
            <Link href={`/crm/cotizaciones/nueva?clienteId=${clienteId}`}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-color)" }}>
              <ClipboardList size={13} /> Cotizarle
            </Link>
          </Bloque>
        </>
      )}
    </aside>
  );
}
