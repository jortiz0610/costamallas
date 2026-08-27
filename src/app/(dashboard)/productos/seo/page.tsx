"use client";

// ============================================================
// SEO masivo — generar en lote y revisar antes de publicar.
//
// 175 de 176 productos no tienen SEO. El generador iba de a uno y ni
// siquiera guardaba, así que hacerlos todos era abrir 175 fichas.
//
// ⚠️ La razón de que esto sea una COLA y no un botón de "escribir todo":
// aprobar una propuesta guarda el producto, y guardar un producto
// publicado lo sincroniza con WooCommerce. O sea: aprobar publica en
// costamallas.com. Texto de IA sin leer, en la tienda, a nombre de la
// empresa. Se genera en lote, se lee, y se aprueba de a uno.
//
// El costo se muestra ANTES de lanzar, y el gasto real se va sumando
// mientras corre — el estimado sirve para decidir, el real es el que
// llega en la factura.
// ============================================================

import { Suspense, useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Loader2, ArrowLeft, Sparkles, Check, X, AlertTriangle, Search,
  DollarSign, Play, StopCircle, ExternalLink, Store, PencilLine,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { esSuperadmin } from "@/lib/permisos";
import { cn } from "@/lib/utils";

interface Candidato {
  id: string; sku: string; nombre: string; publicado: boolean;
  seoTitulo: string | null; categorias: string[];
}
interface Estimacion {
  productos: number; tokensEntrada: number; tokensSalida: number;
  costoUSD: number; modelo: string; usdPorMTok: { entrada: number; salida: number };
  origen: "medido" | "estimado"; corridas: number;
}
interface DatosLote {
  productos: Candidato[];
  estimacion: Estimacion;
  pendientesRevision: number;
  ia: { configurada: boolean; origen: string; descifraBien: boolean };
}
interface Propuesta {
  id: string; estado: string; loteId: string | null;
  seoTitulo: string; seoDescripcion: string; seoKeywords: string[];
  seoTexto: string; slug: string; aplicaSlug: boolean;
  costoUSD: number; error: string | null; createdAt: string;
  producto: {
    id: string; sku: string; nombre: string; slug: string; publicado: boolean;
    wcId: number | null; categorias: string[];
    seoTitulo: string | null; seoDescripcion: string | null; seoKeywords: string[];
    imagenes: { id: string; urlImagen: string; esPrincipal: boolean }[];
  };
}

const usd = (v: number) => `US$ ${v < 0.01 ? v.toFixed(4) : v.toFixed(2)}`;
const miles = (v: number) => v.toLocaleString("es-CO");

function Contenido() {
  const { user } = useAuth();
  const admin = esSuperadmin(user?.rol);

  const [pestana, setPestana] = useState<"generar" | "revisar">("generar");

  // ── Selección del lote ──
  const [publicado, setPublicado] = useState<"" | "1" | "0">("");
  const [busqueda, setBusqueda] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  // ── Corrida ──
  const [corriendo, setCorriendo] = useState(false);
  const [avance, setAvance] = useState({ hechos: 0, total: 0, costoUSD: 0, fallidos: 0 });
  const detener = useRef(false);

  const { data, isLoading, refetch } = useQuery<DatosLote>({
    queryKey: ["seo-lote", publicado],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (publicado) q.set("publicado", publicado);
      const j = await (await fetch(`/api/ai/seo/lote?${q}`)).json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    enabled: admin,
  });

  const { data: cola, refetch: refetchCola } = useQuery<{ data: Propuesta[]; resumen: Record<string, { cantidad: number; costoUSD: number }> }>({
    queryKey: ["seo-propuestas"],
    queryFn: async () => (await (await fetch("/api/ai/seo/propuestas?estado=PROPUESTO")).json()),
    enabled: admin,
  });

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return data?.productos ?? [];
    return (data?.productos ?? []).filter(
      p => p.sku.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t),
    );
  }, [data, busqueda]);

  // El costo de LO SELECCIONADO, que es lo que se va a pagar. Se saca a
  // regla de tres sobre la estimación del conjunto: los prompts son de
  // tamaño parecido y el error de eso es menor que el de la estimación
  // misma. El número que importa de verdad — el real — aparece abajo
  // mientras el lote corre.
  const costoSeleccion = useMemo(() => {
    const e = data?.estimacion;
    if (!e || !e.productos) return 0;
    return (e.costoUSD / e.productos) * marcados.size;
  }, [data, marcados]);

  const alternar = (id: string) =>
    setMarcados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const lanzar = async () => {
    const ids = [...marcados];
    if (!ids.length) return toast.error("No hay productos seleccionados");

    setCorriendo(true);
    detener.current = false;
    setAvance({ hechos: 0, total: ids.length, costoUSD: 0, fallidos: 0 });

    // El lote se identifica con la hora de arranque: si la pantalla se
    // cierra a mitad, volver a lanzar la misma selección continúa donde
    // iba en vez de pagar otra vez por lo ya hecho.
    const loteId = `lote-${Date.now()}`;

    try {
      let restantes = ids.length;
      while (restantes > 0 && !detener.current) {
        const res = await fetch("/api/ai/seo/lote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productoIds: ids, loteId, tanda: 3 }),
        });
        const j = await res.json();
        if (!j.success) { toast.error(j.error ?? "El lote se detuvo"); break; }

        restantes = j.data.restantes;
        setAvance(a => ({
          hechos: a.hechos + j.data.procesados,
          total: ids.length,
          costoUSD: a.costoUSD + j.data.costoUSD,
          fallidos: a.fallidos + j.data.fallidos,
        }));
        if (j.data.procesados === 0) break; // nada avanzó: no dar vueltas
      }
      toast.success(detener.current ? "Lote detenido" : "Lote terminado");
      setMarcados(new Set());
      refetch(); refetchCola();
      setPestana("revisar");
    } finally {
      setCorriendo(false);
    }
  };

  if (!admin) {
    return (
      <div className="card p-6 max-w-lg">
        <p className="text-sm font-bold text-soft">Solo el superadministrador</p>
        <p className="text-xs text-muted mt-2">
          Lanzar lotes de IA gasta dinero y aprobar el resultado publica en costamallas.com, así que
          este módulo está reservado al superadministrador.
        </p>
      </div>
    );
  }

  const pendientes = cola?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/productos" className="btn-secondary btn-sm flex items-center gap-1.5">
          <ArrowLeft size={13} /> Productos
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">SEO con IA</h1>
          <p className="text-xs text-muted">Se genera en lote y se aprueba de a uno. Nada sale a la tienda sin que alguien lo lea.</p>
        </div>
      </div>

      {/* Aviso que no se puede tapar: aprobar publica. */}
      <div className="card p-4 flex gap-3" style={{ borderLeft: "4px solid #d97706" }}>
        <Store size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} />
        <div>
          <p className="text-xs font-bold text-soft">Aprobar una propuesta la publica en costamallas.com</p>
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            Guardar el SEO de un producto que está en la tienda dispara la sincronización con WooCommerce.
            Por eso la IA no escribe directo: deja la propuesta aquí y espera. Los productos que aún no
            están publicados no salen a ninguna parte hasta que se publiquen.
          </p>
        </div>
      </div>

      {data && !data.ia.configurada && (
        <div className="card p-4 flex gap-3" style={{ borderLeft: "4px solid #dc2626" }}>
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="text-xs font-bold text-soft">La IA no está configurada</p>
            <p className="text-[11px] text-muted mt-1">
              Falta la API key de Claude. Se carga en Configuración → IA, <strong>desde el portal en producción</strong>.
              Sin ella el lote no puede generar nada.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {([["generar", "Generar"], ["revisar", `Por revisar${pendientes.length ? ` (${pendientes.length})` : ""}`]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setPestana(k)}
            className={cn("px-4 py-2 rounded-xl text-xs font-bold", pestana === k ? "text-white" : "text-muted surface-2")}
            style={pestana === k ? { backgroundColor: "var(--brand-color)" } : undefined}
          >
            {l}
          </button>
        ))}
      </div>

      {pestana === "generar" ? (
        <>
          {isLoading || !data ? (
            <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>
          ) : (
            <>
              {/* Estimación: lo que hay que ver ANTES de gastar */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={15} style={{ color: "var(--brand-color)" }} />
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Qué costaría</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Dato label="Sin SEO" valor={String(data.estimacion.productos)} sub="productos candidatos" />
                  <Dato label="Tokens de entrada" valor={miles(data.estimacion.tokensEntrada)} sub="estimado" />
                  <Dato label="Tokens de salida" valor={miles(data.estimacion.tokensSalida)} sub="estimado" />
                  <Dato
                    label="Costo del total"
                    valor={usd(data.estimacion.costoUSD)}
                    sub={data.estimacion.origen === "medido"
                      ? `medido sobre ${data.estimacion.corridas} corrida(s)`
                      : `estimado · ${data.estimacion.modelo}`}
                    destacado
                  />
                </div>
                <p className="text-[11px] text-muted mt-3 leading-relaxed">
                  {data.estimacion.origen === "medido" ? (
                    <>
                      El costo sale de lo que <strong>costó de verdad</strong>: la mediana de las últimas{" "}
                      {data.estimacion.corridas} generaciones registradas, no de un cálculo. Se prefiere así
                      porque calcularlo por el tamaño del texto se quedaba un 30 % corto — los productos
                      reales traen más imágenes que describir de las que supone la fórmula.
                    </>
                  ) : (
                    <>
                      Es una <strong>estimación</strong>: nunca se ha generado SEO, así que el número sale
                      del tamaño de cada prompt. En cuanto se genere el primero, pasa a ser el costo medido.
                    </>
                  )}{" "}
                  El gasto real se va sumando abajo mientras el lote corre, y ése es el que aparece en la
                  factura. Tarifa {data.estimacion.modelo}: US$ {data.estimacion.usdPorMTok.entrada}/MTok de
                  entrada, US$ {data.estimacion.usdPorMTok.salida}/MTok de salida.
                </p>
              </div>

              {/* Selección */}
              <div className="card p-5">
                <div className="flex flex-wrap gap-2 items-center mb-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      className="input pl-8 text-xs" placeholder="Buscar por SKU o nombre"
                      value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    />
                  </div>
                  <select className="input max-w-[180px] text-xs" value={publicado} onChange={e => { setPublicado(e.target.value as "" | "1" | "0"); setMarcados(new Set()); }}>
                    <option value="">Publicados y borradores</option>
                    <option value="1">Solo publicados</option>
                    <option value="0">Solo sin publicar</option>
                  </select>
                  <button className="btn-secondary btn-sm" onClick={() => setMarcados(new Set(visibles.map(p => p.id)))}>
                    Marcar los {visibles.length}
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setMarcados(new Set())}>Ninguno</button>
                </div>

                <p className="text-[11px] text-muted mb-3">
                  Los publicados van primero: son los que ya están en Google y los que más pierden sin SEO.
                </p>

                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <div className="max-h-[380px] overflow-y-auto">
                    {visibles.length === 0 ? (
                      <p className="text-xs text-muted p-6 text-center">
                        No hay productos sin SEO con ese filtro. Si es la primera vez que lo ves vacío, ya está todo hecho.
                      </p>
                    ) : visibles.map(p => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:surface-2"
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} className="accent-[var(--brand-color)]" />
                        <span className="font-mono text-[11px] text-muted w-40 flex-shrink-0 truncate">{p.sku}</span>
                        <span className="text-xs text-soft flex-1 truncate">{p.nombre}</span>
                        {p.publicado
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: "#16a34a22", color: "#16a34a" }}>en tienda</span>
                          : <span className="text-[10px] text-muted px-2">borrador</span>}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lanzar */}
              <div className="card p-5">
                {corriendo && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-soft">
                        {avance.hechos} de {avance.total}
                        {avance.fallidos > 0 && <span className="text-red-500 font-normal"> · {avance.fallidos} fallaron</span>}
                      </span>
                      <span className="font-mono font-bold" style={{ color: "var(--brand-color)" }}>
                        gastado: {usd(avance.costoUSD)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full surface-2 overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${avance.total ? (avance.hechos / avance.total) * 100 : 0}%`, backgroundColor: "var(--brand-color)" }}
                      />
                    </div>
                    <p className="text-[11px] text-muted mt-2">
                      Va de tres en tres porque la función del servidor se corta al minuto. Puedes dejar
                      esta pestaña abierta; si la cierras, volver a lanzar la misma selección continúa
                      donde iba y no cobra dos veces lo ya hecho.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {corriendo ? (
                    <button onClick={() => { detener.current = true; }} className="btn-secondary flex items-center gap-2">
                      <StopCircle size={14} /> Detener
                    </button>
                  ) : (
                    <button
                      onClick={lanzar}
                      disabled={!marcados.size || !data.ia.configurada}
                      className="btn-primary flex items-center gap-2 disabled:opacity-40"
                    >
                      <Play size={14} /> Generar {marcados.size || ""} propuesta{marcados.size === 1 ? "" : "s"}
                    </button>
                  )}
                  {!!marcados.size && !corriendo && (
                    <span className="text-xs text-muted">
                      Costo estimado de la selección: <strong className="text-soft">{usd(costoSeleccion)}</strong>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <ColaRevision propuestas={pendientes} onCambio={() => { refetchCola(); refetch(); }} />
      )}
    </div>
  );
}

function Dato({ label, valor, sub, destacado }: { label: string; valor: string; sub?: string; destacado?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("font-bold mt-0.5", destacado ? "text-xl" : "text-base")} style={destacado ? { color: "var(--brand-color)" } : undefined}>{valor}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}

// ── La cola ─────────────────────────────────────────────────

function ColaRevision({ propuestas, onCambio }: { propuestas: Propuesta[]; onCambio: () => void }) {
  if (!propuestas.length) {
    return (
      <div className="card p-10 text-center">
        <Sparkles size={22} className="mx-auto text-muted mb-3" />
        <p className="text-sm font-bold text-soft">No hay nada por revisar</p>
        <p className="text-xs text-muted mt-1">Genera un lote en la otra pestaña y las propuestas aparecen aquí.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {propuestas.length} propuesta{propuestas.length === 1 ? "" : "s"} esperando. Puedes corregir el texto
        antes de aprobar: se aplica lo que quede en pantalla, no lo que escribió la IA.
      </p>
      {propuestas.map(p => <Tarjeta key={p.id} p={p} onCambio={onCambio} />)}
    </div>
  );
}

function Tarjeta({ p, onCambio }: { p: Propuesta; onCambio: () => void }) {
  const [titulo, setTitulo] = useState(p.seoTitulo);
  const [descripcion, setDescripcion] = useState(p.seoDescripcion);
  const [texto, setTexto] = useState(p.seoTexto);
  const [slug, setSlug] = useState(p.slug);
  const [aplicaSlug, setAplicaSlug] = useState(p.aplicaSlug);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (accion: "aprobar" | "rechazar" | "") => {
    setOcupado(true);
    try {
      const res = await fetch("/api/ai/seo/propuestas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: p.id, accion,
          edicion: { seoTitulo: titulo, seoDescripcion: descripcion, seoTexto: texto, slug, aplicaSlug },
        }),
      });
      const j = await res.json();
      if (!j.success) return toast.error(j.error ?? "No se pudo");
      toast.success(j.data?.detalle ?? "Listo");
      if (j.data?.sync) toast(j.data.sync, { icon: "🛒" });
      if (accion) onCambio();
    } finally { setOcupado(false); }
  };

  if (p.estado === "ERROR") {
    return (
      <div className="card p-4" style={{ borderLeft: "4px solid #dc2626" }}>
        <p className="text-xs font-bold text-soft">{p.producto.sku} — no se pudo generar</p>
        <p className="text-[11px] text-muted mt-1 break-words">{p.error}</p>
      </div>
    );
  }

  const principal = p.producto.imagenes.find(i => i.esPrincipal) ?? p.producto.imagenes[0];
  const largoTitulo = titulo.length;
  const largoDesc = descripcion.length;

  return (
    <div className="card p-5">
      <div className="flex gap-4 items-start">
        {principal && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={principal.urlImagen} alt="" className="w-16 h-16 object-cover rounded-xl flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-muted">{p.producto.sku}</span>
            {p.producto.publicado
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: "#16a34a22", color: "#16a34a" }}>en tienda</span>
              : <span className="text-[10px] text-muted">borrador</span>}
            <span className="text-[10px] text-muted font-mono">{usd(p.costoUSD)}</span>
          </div>
          <p className="text-sm font-bold text-soft truncate">{p.producto.nombre}</p>
          {p.producto.seoTitulo && (
            <p className="text-[11px] text-muted mt-1">
              Reemplaza el actual: <span className="italic">{p.producto.seoTitulo}</span>
            </p>
          )}
        </div>
        <Link href={`/productos/${p.producto.id}`} className="btn-secondary btn-sm flex items-center gap-1.5 flex-shrink-0">
          <ExternalLink size={12} /> Ficha
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <Campo label="Meta título" limite={60} largo={largoTitulo}>
          <input className="input text-[13px]" value={titulo} onChange={e => setTitulo(e.target.value.slice(0, 60))} />
        </Campo>
        <Campo label="Meta descripción" limite={160} largo={largoDesc}>
          <textarea className="input text-[13px] resize-none" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value.slice(0, 160))} />
        </Campo>
        <Campo label="Texto de venta">
          <textarea className="input text-[13px] resize-none" rows={3} value={texto} onChange={e => setTexto(e.target.value)} />
        </Campo>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Dirección (slug)</label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
              <input type="checkbox" checked={aplicaSlug} onChange={e => setAplicaSlug(e.target.checked)} className="accent-[var(--brand-color)]" />
              cambiarla
            </label>
          </div>
          <input
            className="input font-mono text-xs disabled:opacity-50"
            value={slug} disabled={!aplicaSlug}
            onChange={e => setSlug(e.target.value)}
          />
          {p.producto.publicado && aplicaSlug && slug !== p.producto.slug && (
            <p className="text-[11px] mt-1 font-semibold" style={{ color: "#d97706" }}>
              ⚠️ Este producto ya está en la tienda con la dirección <span className="font-mono">{p.producto.slug}</span>.
              Cambiarla rompe el enlace que Google tiene indexado y los que haya por ahí compartidos.
            </p>
          )}
          {!aplicaSlug && (
            <p className="text-[11px] text-muted mt-1">Se deja la actual: <span className="font-mono">{p.producto.slug}</span></p>
          )}
        </div>

        {p.seoKeywords.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Palabras clave</p>
            <div className="flex flex-wrap gap-1.5">
              {p.seoKeywords.map(k => (
                <span key={k} className="text-[11px] px-2 py-1 rounded-lg surface-2 text-soft">{k}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={() => enviar("aprobar")} disabled={ocupado} className="btn-primary btn-sm flex items-center gap-1.5">
          {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Aprobar{p.producto.publicado ? " y publicar" : ""}
        </button>
        <button onClick={() => enviar("")} disabled={ocupado} className="btn-secondary btn-sm flex items-center gap-1.5">
          <PencilLine size={12} /> Guardar cambios
        </button>
        <button onClick={() => enviar("rechazar")} disabled={ocupado} className="btn-secondary btn-sm flex items-center gap-1.5 text-red-500">
          <X size={12} /> Descartar
        </button>
      </div>
    </div>
  );
}

function Campo({ label, limite, largo, children }: { label: string; limite?: number; largo?: number; children: React.ReactNode }) {
  const apretado = limite != null && largo != null && largo > limite - 5;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</label>
        {limite != null && (
          <span className={cn("text-[10px] font-mono", apretado ? "text-amber-500" : "text-muted")}>{largo}/{limite}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Topbar title="SEO con IA" />
      <div className="flex-1 overflow-y-auto page-bg p-4 md:p-6 pb-24 lg:pb-6">
        <Contenido />
      </div>
    </Suspense>
  );
}
