"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2, Users, Package, ClipboardList, CheckSquare, GitBranch } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { formatCOP } from "@/lib/utils";

type Msg = { rol: "user" | "ia"; texto: string };

const SUGERENCIAS = [
  { l: "Resumen de clientes", Icon: Users },
  { l: "Estado de productos", Icon: Package },
  { l: "Cotizaciones", Icon: ClipboardList },
  { l: "Mis tareas", Icon: CheckSquare },
  { l: "¿Cómo funciona el flujo de cotizaciones?", Icon: GitBranch },
];

async function j(url: string) { try { return await (await fetch(url)).json(); } catch { return null; } }

// Motor de respuestas: lee datos reales del sistema (sin LLM externo por ahora)
async function responder(pregunta: string): Promise<string> {
  const q = pregunta.toLowerCase();

  if (/(flujo|proceso|funciona|estados?).*(cotiza)|cotiza.*(flujo|proceso|estado|funciona)/.test(q) || (q.includes("flujo") && q.includes("cotiz"))) {
    return [
      "📋 **Flujo de cotizaciones:**",
      "1. **Borrador** → la creas (manual o con el Cotizador a medida).",
      "2. **Enviada** → se la mandas al cliente.",
      "3. **Aprobada** → al aprobarla se genera **automáticamente un Pedido**.",
      "4. **Rechazada / Vencida** → si no procede o caduca.",
      "",
      "El Pedido luego avanza por el Pipeline de producción: Nuevo → Confirmado → En producción → Listo → Despachado → Entregado → Instalado.",
    ].join("\n");
  }

  if (q.includes("proceso") || q.includes("flujo")) {
    return [
      "🔄 **Procesos principales del sistema:**",
      "• **Venta (CRM):** Cliente → Cotización → Pedido → Instalación.",
      "• **Catálogo (ERP):** Producto → Imágenes → SEO → Exportar a WooCommerce.",
      "• **Comunicación (Nexus):** Mensaje entra → se asigna → se responde → se guarda el contacto en el CRM.",
      "Pregúntame por un proceso específico (ej: \"flujo de cotizaciones\").",
    ].join("\n");
  }

  if (q.includes("cliente")) {
    const r = await j("/api/crm/clientes");
    const cs: { estado: string }[] = r?.data ?? [];
    const porEstado: Record<string, number> = {};
    cs.forEach(c => { porEstado[c.estado] = (porEstado[c.estado] ?? 0) + 1; });
    const activos = cs.filter(c => ["CLIENTE_ACTIVO", "RECURRENTE", "VIP"].includes(c.estado)).length;
    const top = Object.entries(porEstado).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([e, n]) => `   • ${e}: ${n}`).join("\n");
    return `👥 **Clientes:** ${cs.length} en total, ${activos} activos.\n\nPor estado:\n${top || "   • Sin datos"}`;
  }

  if (q.includes("producto") || q.includes("stock") || q.includes("inventario")) {
    const r = await j("/api/dashboard/kpis");
    const d = r?.data;
    if (!d) return "No pude leer los productos ahora.";
    return [
      `📦 **Productos:** ${d.productos.total} en total, ${d.productos.publicados} publicados.`,
      `   • Sin imagen: ${d.productos.sinImagen}`,
      `   • Sin precio: ${d.productos.sinPrecio}`,
      `   • Stock crítico: ${d.stock.criticos}`,
      `   • Precio promedio: ${formatCOP(d.productos.precioPromedio)}`,
    ].join("\n");
  }

  if (q.includes("cotiza")) {
    const r = await j("/api/crm/cotizaciones");
    const cs: { estado: string; total: number }[] = r?.data ?? [];
    const porEstado: Record<string, number> = {};
    cs.forEach(c => { porEstado[c.estado] = (porEstado[c.estado] ?? 0) + 1; });
    const pipeline = cs.filter(c => ["ENVIADA", "BORRADOR"].includes(c.estado)).reduce((a, c) => a + Number(c.total), 0);
    const det = Object.entries(porEstado).map(([e, n]) => `   • ${e}: ${n}`).join("\n");
    return `📄 **Cotizaciones:** ${cs.length} en total.\n\n${det || "   • Sin datos"}\n\n💰 Valor en pipeline (borrador+enviada): ${formatCOP(pipeline)}`;
  }

  if (q.includes("tarea") || q.includes("pendiente")) {
    const r = await j("/api/crm/tareas?estado=PENDIENTE");
    const ts: { titulo: string; fechaVence?: string }[] = r?.data ?? [];
    const vencidas = ts.filter(t => t.fechaVence && new Date(t.fechaVence) < new Date()).length;
    const lista = ts.slice(0, 4).map(t => `   • ${t.titulo}`).join("\n");
    return `✅ **Tareas pendientes:** ${ts.length}${vencidas ? ` (${vencidas} vencidas ⚠️)` : ""}.\n\n${lista || "   ¡Sin tareas pendientes! 🎉"}`;
  }

  if (q.includes("pedido")) {
    const r = await j("/api/crm/pedidos");
    const ps: { estado: string; total: number }[] = r?.data ?? [];
    const activos = ps.filter(p => p.estado !== "CANCELADO");
    const valor = activos.reduce((a, p) => a + Number(p.total), 0);
    return `🛒 **Pedidos:** ${activos.length} activos, valor total ${formatCOP(valor)}.`;
  }

  if (q.includes("hola") || q.includes("ayuda") || q.includes("puedes")) {
    return "¡Hola! 👋 Soy tu asistente. Puedo darte el **estado actual** de clientes, productos, cotizaciones, pedidos y tareas, y explicarte los **procesos y flujos** del sistema. Prueba los botones de abajo o escríbeme.";
  }

  // Pregunta abierta → intentar IA generativa (si hay API key configurada)
  try {
    const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta }) });
    const json = await res.json();
    if (json.success) return json.data.respuesta;
    if (json.sinClave) {
      return "Esa pregunta necesita IA generativa 🤖. Actívala pegando tu API key en **Configuración → IA**. Mientras tanto puedo darte el estado de **clientes, productos, cotizaciones, pedidos, tareas** o explicarte **procesos y flujos**.";
    }
    return json.error ?? "No pude procesar esa pregunta.";
  } catch {
    return "Puedo ayudarte con: estado de **clientes**, **productos**, **cotizaciones**, **pedidos**, **tareas**, o explicarte **procesos y flujos**.";
  }
}

function fmt(texto: string) {
  // Negritas simples **x**
  return texto.split("\n").map((linea, i) => (
    <span key={i} className="block">
      {linea.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
          : <span key={j}>{part}</span>
      )}
    </span>
  ));
}

export function AsistenteIA() {
  const { brand } = useBrand();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ rol: "ia", texto: "¡Hola! 👋 Soy tu asistente de Costamallas. Pregúntame por el estado de tu negocio o cómo funciona algún proceso." }]);
  const [input, setInput] = useState("");
  const [pensando, setPensando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, pensando]);

  const enviar = async (texto: string) => {
    if (!texto.trim() || pensando) return;
    setMsgs(m => [...m, { rol: "user", texto }]);
    setInput("");
    setPensando(true);
    const r = await responder(texto);
    setMsgs(m => [...m, { rol: "ia", texto: r }]);
    setPensando(false);
  };

  return (
    <>
      {/* Botón flotante */}
      <button onClick={() => setOpen(v => !v)}
        className="fixed bottom-20 lg:bottom-6 right-5 lg:right-6 z-40 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all hover:scale-105"
        style={{ background: `linear-gradient(135deg, ${brand.brandColor}, ${brand.brandColor}bb)` }}
        title="Asistente IA">
        {open ? <X size={22} className="text-white" /> : <Sparkles size={24} className="text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-36 lg:bottom-24 right-4 lg:right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-12rem)] card flex flex-col overflow-hidden animate-fade-up">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${brand.brandColor}, ${brand.brandColor}cc)` }}>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Sparkles size={18} className="text-white" /></div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Asistente IA</p>
              <p className="text-[10px] text-white/70">Estado del negocio y procesos</p>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">BETA</span>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.rol === "user" ? "text-white rounded-br-sm" : "surface-2 text-soft rounded-bl-sm"}`}
                  style={m.rol === "user" ? { backgroundColor: brand.brandColor } : {}}>
                  {fmt(m.texto)}
                </div>
              </div>
            ))}
            {pensando && <div className="flex justify-start"><div className="surface-2 rounded-2xl px-3.5 py-2.5"><Loader2 size={14} className="animate-spin text-muted" /></div></div>}
          </div>

          {/* Sugerencias */}
          {msgs.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {SUGERENCIAS.map(s => {
                const Icon = s.Icon;
                return (
                  <button key={s.l} onClick={() => enviar(s.l)}
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg surface-2 text-soft hover:brand-bg-10 transition-colors">
                    <Icon size={11} /> {s.l}
                  </button>
                );
              })}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t divider flex items-center gap-2 flex-shrink-0">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") enviar(input); }}
              className="input py-2 text-sm" placeholder="Escribe tu pregunta..." />
            <button onClick={() => enviar(input)} disabled={pensando || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40" style={{ backgroundColor: brand.brandColor }}>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
