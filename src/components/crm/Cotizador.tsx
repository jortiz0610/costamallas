"use client";

// ============================================================
// Cotizador único — crear y editar.
//
// Antes había DOS pantallas: "Cotizaciones → Nueva" (producto por
// cantidad) y "Cotizador a medida" (largo × ancho). El vendedor tenía que
// saber de antemano cuál abrir, y si el pedido mezclaba las dos cosas no
// había forma de cotizarlo en un solo documento.
//
// Ahora es una sola: cada línea decide si va por cantidad o por medidas.
// El check de medidas sale solo en los productos marcados como
// "fabricación a medida" en el catálogo.
// ============================================================

import { useState, Suspense, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Search, Plus, Trash2, X, Loader2, Save, Ruler, Package,
  UserPlus, Wrench, FileText, LayoutTemplate, MapPin, ShieldAlert, ShoppingCart, Eye, Mail,
  ClipboardCheck, HardHat, FlaskConical, Copy,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP, cn } from "@/lib/utils";
import { calcularCotizacion } from "@/lib/cotizacion-calculo";
import type { ServicioInstalacion, RecargoCiudad } from "@/components/configuracion/TabInstalacion";

const CRM_COLOR = "#BA7517";

/** Con qué empieza la línea que el propio cotizador agrega por el
 *  desplazamiento. Al editar hay que reconocerla para NO volver a
 *  cargarla como si fuera una línea escrita por el asesor: se recalcula
 *  sola desde la ciudad, y si se conservara se duplicaría en cada
 *  guardado. */
const PREFIJO_RECARGO = "Desplazamiento y viáticos";

interface Producto {
  id: string; sku: string; nombre: string; precioNormal: number | null; stock: number;
  acfUnidadVenta?: string | null; acfFabricacionMedida?: boolean; imagenPrincipal?: string | null;
  categorias: string[];
  /// No admite descuento por linea. Viene del catalogo.
  sinDescuento?: boolean;
}
interface Cliente { id: string; nombre: string; empresa?: string; email?: string; telefono?: string; ciudad?: string; direccion?: string; nit?: string; }

interface Linea {
  productoId?: string;
  descripcion: string;
  detalle: string;
  /** Cuando es true la cantidad se calcula con largo × ancho. */
  aMedida: boolean;
  puedeMedida: boolean;
  largo: number;
  ancho: number;
  unidades: number;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  /// El producto no admite descuento por línea. Viene del catálogo.
  sinDescuento?: boolean;
  unidad: string;
  imagenUrl?: string | null;
  tipo: "PRODUCTO" | "INSTALACION";
}

/** m² = largo × ancho × número de piezas, redondeado a 2 decimales. */
function metrosCuadrados(l: number, a: number, u: number): number {
  return Math.round(l * a * Math.max(u, 1) * 100) / 100;
}

/** El formato que trajo producción de la visita. Solo para mirarlo. */
interface VisitaEnlazada {
  id: string;
  resumen: string;
  donde: string;
  cuando: string;
  cuantos: number;
}

/**
 * El cotizador, que sirve para las dos cosas.
 *
 * Sin `cotizacionId` crea una nueva. Con él carga la que ya existe y
 * la guarda con PUT. Es el mismo formulario a propósito: mantener una
 * pantalla de crear y otra de editar significa que dentro de un mes
 * una tiene el AIU y la otra no.
 *
 * Con `visitaId` arranca CON la visita técnica delante: el cliente
 * puesto, la dirección donde se midió, y lo que recomendó producción ya
 * como líneas —sin precio, que lo pone el asesor—. Es el paso que antes
 * se hacía copiando un correo a mano.
 */
export function Cotizador({ cotizacionId, visitaId }: { cotizacionId?: string; visitaId?: string }) {
  const router = useRouter();

  const [clienteId, setClienteId] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clienteBusq, setClienteBusq] = useState("");
  const [prodBusq, setProdBusq] = useState("");
  const buscadorRef = useRef<HTMLInputElement>(null);

  /** La oferta que se acaba de corregir y que el cliente ya tenía. */
  const [reenviar, setReenviar] = useState<{ id: string; numero: string } | null>(null);
  const [reenviando, setReenviando] = useState(false);

  const mandarDeNuevo = async () => {
    if (!reenviar) return;
    setReenviando(true);
    try {
      const r = await fetch(`/api/crm/cotizaciones/${reenviar.id}/enviar`, { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast.error(j.error ?? "No se pudo reenviar");
        return;
      }
      toast.success("Se le mandó la versión nueva");
    } catch {
      toast.error("Sin conexión. Inténtalo desde la cotización.");
    } finally {
      setReenviando(false);
      const id = reenviar.id;
      setReenviar(null);
      router.push(`/crm/cotizaciones/${id}`);
    }
  };

  /**
   * Lleva al buscador de productos y lo enfoca.
   *
   * `scrollIntoView` primero porque en el teléfono el buscador puede
   * estar fuera de pantalla, y enfocar sin desplazar deja el cursor
   * puesto en un campo que no se ve.
   */
  const irAlBuscador = () => {
    buscadorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => buscadorRef.current?.focus(), 320);
  };
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  // AIU. Apagado por defecto: una oferta de material suelto no lo lleva,
  // y encenderlo cambia el IVA, así que lo decide el asesor.
  const [aiuActivo, setAiuActivo] = useState(false);
  const [aiuPct, setAiuPct] = useState({ admin: 10, imprev: 5, utilidad: 10 });
  // Vacío = sale del porcentaje. Con valor, manda el valor: la
  // administración y los imprevistos se negocian como suma fija.
  const [aiuMonto, setAiuMonto] = useState({ admin: "", imprev: "", utilidad: "" });
  // Vacío = se aplica el mínimo de la política. Solo se escribe cuando
  // se pactó uno distinto.
  const [anticipoPct, setAnticipoPct] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [plantilla, setPlantilla] = useState<"EXPRESS" | "PROPUESTA">("EXPRESS");
  const [validezDias, setValidezDias] = useState(3);
  const { puedeVer } = useAuth();
  const puedeProbar = puedeVer("crm.cotizaciones.prueba");
  const [incluyeInstalacion, setIncluyeInstalacion] = useState(false);
  // Trabajo previo que hay que coordinar con producción. No cambian el
  // precio: cambian a quién le llega la oferta y qué tiene que hacer.
  const [requiereVisita, setRequiereVisita] = useState(false);
  const [requiereSgsst, setRequiereSgsst] = useState(false);
  // Cotización de prueba. La casilla solo se ve con el permiso; el
  // servidor lo vuelve a comprobar, porque una prueba que se cuela como
  // oferta real acaba en el embudo.
  const [esPrueba, setEsPrueba] = useState(false);
  const [ciudadInstalacion, setCiudadInstalacion] = useState("");
  const [direccionInstalacion, setDireccionInstalacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  // ── Edición ──
  const editando = Boolean(cotizacionId);
  const [cargando, setCargando] = useState(editando);
  const [original, setOriginal] = useState<{ numero: string; estado: string } | null>(null);

  // ── La visita de la que sale esta oferta ──
  // Solo al CREAR: abrir a editar una oferta vieja con `?visita=` en la
  // dirección volvería a volcar las líneas encima de lo que ya escribió
  // el asesor.
  const desdeVisita = Boolean(visitaId) && !editando;
  const [visita, setVisita] = useState<VisitaEnlazada | null>(null);
  const [cargandoVisita, setCargandoVisita] = useState(desdeVisita);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["cot-clientes", clienteBusq],
    enabled: clienteBusq.length > 1,
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`)).json()).data ?? [],
  });

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["cot-productos", prodBusq],
    enabled: prodBusq.length > 1,
    queryFn: async () => (await (await fetch(`/api/productos?busqueda=${encodeURIComponent(prodBusq)}&limit=8`)).json()).data ?? [],
  });

  const { data: catalogo } = useQuery<{ servicios: ServicioInstalacion[]; ciudades: RecargoCiudad[] }>({
    queryKey: ["instalacion-catalogo-activo"],
    queryFn: async () => (await (await fetch("/api/crm/instalacion-catalogo")).json()).data ?? { servicios: [], ciudades: [] },
  });

  const { data: politica } = useQuery<{ descuentoMaxPct: number; anticipoMinPct: number; exigirAprobacion: boolean }>({
    queryKey: ["config-comercial-lectura"],
    queryFn: async () => (await (await fetch("/api/configuracion/comercial")).json()).data,
  });

  const servicios = catalogo?.servicios ?? [];
  const ciudades = catalogo?.ciudades ?? [];
  const recargo = ciudades.find(c => c.ciudad.toLowerCase() === ciudadInstalacion.trim().toLowerCase());

  // ── Líneas ──
  const agregarProducto = (p: Producto) => {
    const puedeMedida = Boolean(p.acfFabricacionMedida);
    setLineas(prev => [...prev, {
      productoId: p.id,
      descripcion: p.nombre,
      detalle: "",
      aMedida: puedeMedida,
      puedeMedida,
      largo: 1, ancho: 1, unidades: 1,
      cantidad: 1,
      precioUnitario: p.precioNormal ?? 0,
      descuento: 0,
      unidad: puedeMedida ? "m2" : (p.acfUnidadVenta ?? "unidad"),
      imagenUrl: p.imagenPrincipal ?? null,
      sinDescuento: Boolean(p.sinDescuento),
      tipo: "PRODUCTO",
    }]);
    setProdBusq("");
  };

  /** Instalación sin precio cerrado: queda en la oferta como "a convenir". */
  const agregarInstalacionLibre = () => {
    setLineas(prev => [...prev, {
      descripcion: "Instalación",
      detalle: "El valor se confirma con la visita técnica.",
      aMedida: false, puedeMedida: false,
      largo: 1, ancho: 1, unidades: 1,
      cantidad: 1,
      precioUnitario: 0,
      descuento: 0,
      unidad: "global",
      tipo: "INSTALACION",
    }]);
  };

  /**
   * Al desmarcar la instalación se quitan sus líneas: dejarlas escondidas
   * sumando al total es peor que borrarlas, porque el asesor vería un
   * total que no cuadra con lo que ve en pantalla.
   */
  const alternarInstalacion = (valor: boolean) => {
    if (!valor && lineas.some(l => l.tipo === "INSTALACION")) {
      if (!confirm("Se quitarán las líneas de instalación de esta cotización. ¿Sigo?")) return;
      setLineas(prev => prev.filter(l => l.tipo !== "INSTALACION"));
      setCiudadInstalacion("");
      setDireccionInstalacion("");
    }
    setIncluyeInstalacion(valor);
  };

  const agregarServicio = (s: ServicioInstalacion) => {
    setLineas(prev => [...prev, {
      descripcion: s.nombre,
      detalle: s.descripcion ?? "",
      aMedida: false, puedeMedida: false,
      largo: 1, ancho: 1, unidades: 1,
      cantidad: 1,
      precioUnitario: s.precioBase,
      descuento: 0,
      unidad: s.unidad,
      tipo: "INSTALACION",
    }]);
  };

  const actualizar = (i: number, cambios: Partial<Linea>) => {
    setLineas(prev => prev.map((l, n) => {
      if (n !== i) return l;
      const nueva = { ...l, ...cambios };
      if (nueva.aMedida) nueva.cantidad = metrosCuadrados(nueva.largo, nueva.ancho, nueva.unidades);
      return nueva;
    }));
  };

  const quitar = (i: number) => setLineas(prev => prev.filter((_, n) => n !== i));

  // ── Totales ──
  // La cuenta la hace la MISMA función que el servidor
  // (lib/cotizacion-calculo). Antes esta pantalla tenía su propia copia
  // con el 19 % escrito aparte: tres sitios calculando dinero, y el que
  // se desvía es siempre el que nadie mira.
  const opcionesAIU = useMemo(() => {
    const monto = (v: string) => (v.trim() === "" ? null : Number(v));
    return {
      activo: aiuActivo,
      adminPct: aiuPct.admin, imprevPct: aiuPct.imprev, utilidadPct: aiuPct.utilidad,
      adminMonto: monto(aiuMonto.admin), imprevMonto: monto(aiuMonto.imprev), utilidadMonto: monto(aiuMonto.utilidad),
    };
  }, [aiuActivo, aiuPct, aiuMonto]);

  const { subtotal, valorInstalacion, recargoValor, cuenta } = useMemo(() => {
    const sub = lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario * (1 - l.descuento / 100), 0);
    const inst = lineas.filter(l => l.tipo === "INSTALACION")
      .reduce((a, l) => a + l.cantidad * l.precioUnitario * (1 - l.descuento / 100), 0);
    // El recargo por desplazamiento se calcula SOLO sobre la instalación:
    // llevar la cuadrilla a otra ciudad no encarece el material.
    const rec = recargo ? inst * (recargo.porcentaje / 100) + (inst > 0 ? recargo.montoFijo : 0) : 0;

    // El recargo entra al cálculo como una línea de INSTALACIÓN, que es
    // exactamente como se guarda al enviar. Si aquí se sumara suelto, la
    // vista previa y lo que guarda el servidor darían distinto en cuanto
    // hay AIU, porque el recargo es parte de la base de la obra.
    const itemsCalc = [
      ...lineas.map(l => ({ cantidad: l.cantidad, precioUnitario: l.precioUnitario, descuento: l.descuento, tipo: l.tipo })),
      ...(rec > 0 ? [{ cantidad: 1, precioUnitario: Math.round(rec), descuento: 0, tipo: "INSTALACION" }] : []),
    ];
    return {
      subtotal: sub,
      valorInstalacion: inst,
      recargoValor: rec,
      cuenta: calcularCotizacion(itemsCalc, descuentoGlobal, opcionesAIU),
    };
  }, [lineas, descuentoGlobal, recargo, opcionesAIU]);

  const iva = cuenta.iva;
  const total = cuenta.total;

  // El sitio de instalación se pide en cuanto se marca la casilla, no
  // cuando ya se agregó una línea: la ciudad es la que define el recargo.
  const hayInstalacion = incluyeInstalacion || lineas.some(l => l.tipo === "INSTALACION");

  // ── Política comercial ──
  // El mismo cálculo que hace el servidor, para poder avisar en pantalla
  // mientras se cotiza. Quien decide sigue siendo el servidor.
  const anticipoEfectivo = anticipoPct === "" ? (politica?.anticipoMinPct ?? null) : Number(anticipoPct);
  const fueraDePolitica = useMemo(() => {
    if (!politica?.exigirAprobacion) return null;
    const bruto = lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0);
    if (bruto <= 0) return null;
    const neto = lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario * (1 - l.descuento / 100), 0)
      * (1 - descuentoGlobal / 100);
    const pct = Math.round(((bruto - neto) / bruto) * 10000) / 100;

    const motivos: string[] = [];
    if (pct > politica.descuentoMaxPct) {
      motivos.push(`El descuento efectivo es ${pct}% y el tope sin aprobación es ${politica.descuentoMaxPct}%.`);
    }
    if (anticipoPct !== "" && Number(anticipoPct) < politica.anticipoMinPct) {
      motivos.push(`El anticipo es ${anticipoPct}% y el mínimo es ${politica.anticipoMinPct}%.`);
    }
    return motivos.length ? motivos.join(" ") : null;
  }, [lineas, descuentoGlobal, anticipoPct, politica]);

  // Carga la cotización que se va a editar y llena el formulario.
  useEffect(() => {
    if (!cotizacionId) return;
    let vivo = true;
    (async () => {
      try {
        const j = await (await fetch(`/api/crm/cotizaciones/${cotizacionId}`)).json();
        if (!vivo) return;
        if (!j.success) { toast.error(j.error ?? "No se pudo cargar la cotización"); return; }
        const c = j.data;
        setOriginal({ numero: c.numero, estado: c.estado });
        setClienteId(c.clienteId);
        setCliente(c.cliente);
        setNotas(c.notas ?? "");
        setPlantilla(c.plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS");
        setValidezDias(c.validezDias ?? 3);
        setIncluyeInstalacion(Boolean(c.tieneInstalacion));
        setRequiereVisita(Boolean(c.requiereVisita));
        setRequiereSgsst(Boolean(c.requiereSgsst));
        setEsPrueba(Boolean(c.esPrueba));
        setCiudadInstalacion(c.ciudadInstalacion ?? "");
        setDireccionInstalacion(c.direccionInstalacion ?? "");
        setAnticipoPct(c.anticipoPct == null ? "" : String(Number(c.anticipoPct)));

        // El descuento global no se guarda como porcentaje, pero se
        // deduce exacto: descuento ÷ subtotal.
        const bruto = Number(c.subtotal) || 0;
        setDescuentoGlobal(bruto > 0 ? Math.round((Number(c.descuento) / bruto) * 10000) / 100 : 0);

        // El recargo por ciudad se descarta: se vuelve a calcular solo.
        const items = (c.items ?? []).filter(
          (it: { descripcion: string }) => !it.descripcion.startsWith(PREFIJO_RECARGO),
        );
        setLineas(items.map((it: {
          productoId: string | null; descripcion: string; detalle: string | null;
          cantidad: string; precioUnitario: string; descuento: string;
          unidad: string | null; tipo: string; imagenUrl: string | null;
        }) => ({
          productoId: it.productoId ?? undefined,
          descripcion: it.descripcion,
          // Las medidas se guardaron dentro del detalle como texto, no
          // como largo y ancho: al reabrir la línea queda por cantidad.
          // Si hay que recalcular por medidas, se vuelve a agregar.
          detalle: it.detalle ?? "",
          aMedida: false,
          puedeMedida: false,
          largo: 0, ancho: 0, unidades: 1,
          cantidad: Number(it.cantidad),
          precioUnitario: Number(it.precioUnitario),
          descuento: Number(it.descuento),
          unidad: it.unidad ?? "und",
          imagenUrl: it.imagenUrl,
          tipo: it.tipo === "INSTALACION" ? "INSTALACION" : "PRODUCTO",
        })));

        // AIU. El monto solo se rellena si NO sale del porcentaje: así el
        // asesor ve vacías las casillas que se calculan solas y con valor
        // las que alguien negoció como suma fija.
        setAiuActivo(Boolean(c.aiuActivo));
        setAiuPct({
          admin: Number(c.aiuAdminPct ?? 10),
          imprev: Number(c.aiuImprevPct ?? 5),
          utilidad: Number(c.aiuUtilidadPct ?? 10),
        });
        const obra = items
          .filter((it: { tipo: string }) => it.tipo === "INSTALACION")
          .reduce((a: number, it: { subtotal: string }) => a + Number(it.subtotal), 0);
        const manual = (monto: unknown, pct: unknown) => {
          const m = Number(monto ?? 0);
          if (!m) return "";
          const delPct = (Number(pct ?? 0) / 100) * obra;
          return Math.abs(m - delPct) < 1 ? "" : String(Math.round(m));
        };
        setAiuMonto({
          admin: manual(c.aiuAdmin, c.aiuAdminPct),
          imprev: manual(c.aiuImprev, c.aiuImprevPct),
          utilidad: manual(c.aiuUtilidad, c.aiuUtilidadPct),
        });
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [cotizacionId]);

  /**
   * Carga la visita técnica y arranca la oferta con ella.
   *
   * Qué se vuelca y qué NO:
   *
   *   · **Sí**: el cliente, la dirección y la ciudad donde se midió, y
   *     lo que recomendó producción como líneas —con su cantidad y su
   *     unidad, y en CERO de precio, que es lo único que pone el asesor.
   *   · **No**: las medidas y las condiciones del sitio no se copian a
   *     las observaciones. Las observaciones viajan al cliente en el
   *     enlace público, y en `lib/cierre-trabajo.ts` está decidido —con
   *     su motivo— que al cliente no se le mandan las medidas antes que
   *     el precio. Se enseñan en un panel al lado, que es donde el
   *     asesor las necesita: para calcular, no para publicarlas.
   */
  useEffect(() => {
    if (!desdeVisita || !visitaId) return;
    let vivo = true;
    (async () => {
      try {
        const j = await (await fetch(`/api/crm/visitas/${visitaId}`)).json();
        if (!vivo) return;
        if (!j.success) { toast.error(j.error ?? "No se pudo cargar la visita"); return; }
        const v = j.data;

        if (v.cliente) {
          setClienteId(v.cliente.id);
          setCliente(v.cliente);
        }
        // Donde se midió es donde se instala. Casi siempre no es la
        // dirección de facturación, y ese es justo el dato que se
        // transcribía mal.
        setDireccionInstalacion(v.direccion ?? v.cliente?.direccion ?? "");
        setCiudadInstalacion(v.ciudad ?? v.cliente?.ciudad ?? "");
        // Si hubo visita es porque hay obra que ejecutar: la casilla se
        // marca para que salga el sitio y el recargo por desplazamiento.
        setIncluyeInstalacion(true);

        const recomendados = (v.recomendados ?? []) as
          { nombre: string; cantidad?: number; unidad?: string; nota?: string }[];
        setLineas(recomendados.filter(r => r.nombre?.trim()).map(r => ({
          descripcion: r.nombre,
          detalle: [r.nota, "De la visita técnica"].filter(Boolean).join(" · "),
          aMedida: false,
          puedeMedida: false,
          largo: 0, ancho: 0, unidades: 1,
          cantidad: Number(r.cantidad) > 0 ? Number(r.cantidad) : 1,
          // En cero a propósito: producción no pone precios, y una línea
          // con un precio inventado se envía sin que nadie la mire.
          precioUnitario: 0,
          descuento: 0,
          unidad: r.unidad?.trim() || "und",
          tipo: "PRODUCTO" as const,
        })));

        setVisita({
          id: v.id,
          resumen: v.resumen ?? "",
          donde: [v.direccion, v.ciudad].filter(Boolean).join(", "),
          cuando: v.fechaRealizada
            ? new Date(v.fechaRealizada).toLocaleDateString("es-CO", { day: "numeric", month: "long" })
            : "",
          cuantos: recomendados.length,
        });
      } finally {
        if (vivo) setCargandoVisita(false);
      }
    })();
    return () => { vivo = false; };
  }, [desdeVisita, visitaId]);

  /**
   * Guarda el borrador.
   *
   * `irAlDetalle: false` lo usa la vista previa: guarda, devuelve el id
   * y NO navega, para que el asesor siga cotizando en la misma pantalla
   * mientras mira la previa en otra pestaña.
   */
  const guardar = async (opciones?: { irAlDetalle?: boolean }): Promise<string | null> => {
    const irAlDetalle = opciones?.irAlDetalle !== false;
    if (!clienteId) { toast.error("Elige un cliente"); return null; }
    if (lineas.length === 0) { toast.error("Agrega al menos un producto"); return null; }
    if (lineas.some(l => l.cantidad <= 0)) { toast.error("Hay líneas en cantidad cero"); return null; }

    setGuardando(true);
    try {
      const items = lineas.map(l => ({
        productoId: l.productoId,
        descripcion: l.descripcion,
        detalle: [
          l.aMedida ? `Medidas: ${l.largo} × ${l.ancho} m${l.unidades > 1 ? ` · ${l.unidades} piezas` : ""}` : "",
          l.detalle,
        ].filter(Boolean).join("\n") || undefined,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuento: l.descuento,
        unidad: l.unidad,
        tipo: l.tipo,
        imagenUrl: l.imagenUrl ?? undefined,
      }));

      // El recargo por ciudad viaja como un ítem más: así queda a la vista
      // del cliente en vez de aparecer como un aumento sin explicación.
      if (recargoValor > 0) {
        items.push({
          descripcion: `${PREFIJO_RECARGO} — ${ciudadInstalacion}`,
          cantidad: 1,
          precioUnitario: Math.round(recargoValor),
          descuento: 0,
          unidad: "global",
          tipo: "INSTALACION",
          detalle: recargo ? `Recargo ${recargo.porcentaje > 0 ? `${recargo.porcentaje}%` : ""}${recargo.porcentaje > 0 && recargo.montoFijo > 0 ? " + " : ""}${recargo.montoFijo > 0 ? formatCOP(recargo.montoFijo) : ""} sobre el valor de la instalación.` : undefined,
          productoId: undefined,
          imagenUrl: undefined,
        });
      }

      const res = await fetch(
        editando ? `/api/crm/cotizaciones/${cotizacionId}` : "/api/crm/cotizaciones",
        {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId, items, notas, descuentoGlobal, validezDias,
          aiuActivo,
          aiuAdminPct: aiuPct.admin, aiuImprevPct: aiuPct.imprev, aiuUtilidadPct: aiuPct.utilidad,
          aiuAdmin: aiuMonto.admin, aiuImprev: aiuMonto.imprev, aiuUtilidad: aiuMonto.utilidad,
          tieneInstalacion: hayInstalacion,
          plantilla,
          ciudadInstalacion: ciudadInstalacion || undefined,
          direccionInstalacion: direccionInstalacion || undefined,
          anticipoPct: anticipoPct === "" ? null : Number(anticipoPct),
          requiereVisita,
          requiereSgsst,
          esPrueba,
          // De qué visita salió. El servidor la enlaza al crearla: así
          // desde la visita se ve la oferta y desde la oferta se ve qué
          // se midió, sin que nadie tenga que acordarse de apuntarlo.
          visitaId: desdeVisita ? visitaId : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) { toast.error(j.error ?? "No se pudo guardar"); return null; }
      // Si se salió de la política, se dice AQUÍ: el asesor tiene que
      // saberlo antes de prometerle el precio al cliente por teléfono.
      if (j.aviso) toast(j.aviso, { icon: "⚠️", duration: 7000 });
      toast.success(
        editando
          ? `${j.data.numero} actualizada`
          : `${j.data.numero} guardada como borrador`,
      );

      // ── ¿Le reenviamos la versión nueva? ──
      //
      // Antes esto era un aviso: "el cliente ya tiene el enlace, si la
      // abre verá esta versión". Cierto, pero incompleto — el cliente NO
      // abre el enlace otra vez porque nadie le dijo que había cambiado.
      // El correo salía la primera vez que la oferta pasaba a ENVIADA y
      // nunca más, así que la segunda corrección no le llegaba a nadie.
      //
      // Se PREGUNTA en vez de mandarlo solo: un correo al cliente no se
      // deshace, y hay ediciones que son un dedazo en una nota interna.
      if (j.editadaEnviada && irAlDetalle) {
        setReenviar({ id: j.data.id as string, numero: j.data.numero as string });
        return j.data.id as string;   // se navega cuando conteste
      }
      if (irAlDetalle) router.push(`/crm/cotizaciones/${j.data.id}`);
      return j.data.id as string;
    } finally { setGuardando(false); }
  };

  /**
   * Vista previa: exactamente lo que va a ver el cliente.
   *
   * Guarda primero y abre el enlace público. No hay una "previa" aparte
   * que haya que mantener sincronizada con el documento de verdad: la
   * previa ES el documento. Una previa que se parece pero no es igual es
   * peor que ninguna, porque da confianza sin merecerla.
   *
   * Se abre en otra pestaña para no perder lo que se está cotizando.
   */
  const verPrevia = async () => {
    const id = cotizacionId ?? await guardar({ irAlDetalle: false });
    if (!id) return;
    // Si había cambios sin guardar en una que ya existe, se guardan antes:
    // si no, la previa mostraría la versión anterior.
    if (cotizacionId) await guardar({ irAlDetalle: false });
    window.open(`/crm/cotizaciones/${id}?previa=1`, "_blank", "noopener");
  };

  return (
    <>
      <Topbar
        title={editando ? `Editar ${original?.numero ?? "cotización"}` : "Nueva cotización"}
        actions={
        <div className="flex items-center gap-2">
          <Link
            href={editando && cotizacionId ? `/crm/cotizaciones/${cotizacionId}` : "/crm/cotizaciones"}
            className="btn-secondary btn-sm"
          >
            <ArrowLeft size={13} /> Volver
          </Link>
          {/* Ver la oferta como la va a recibir el cliente, en el formato
              que esté elegido (Express o Propuesta). Guarda antes: una
              previa de algo que no está guardado muestra otra cosa. */}
          <button
            onClick={verPrevia}
            disabled={guardando || cargando || !clienteId || lineas.length === 0}
            title={!clienteId || lineas.length === 0
              ? "Elige un cliente y agrega al menos un producto"
              : "Ver la cotización como la recibe el cliente"}
            className="btn-secondary btn-sm disabled:opacity-40"
          >
            <Eye size={13} /> Vista previa
          </button>
          <button onClick={() => guardar()} disabled={guardando || cargando} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {editando ? "Guardar cambios" : "Guardar borrador"}
          </button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="max-w-[1500px] mx-auto space-y-5">

          {cargando && (
            <div className="card p-10 text-center">
              <Loader2 size={18} className="animate-spin mx-auto" style={{ color: CRM_COLOR }} />
              <p className="text-xs text-muted mt-3">Cargando la cotización…</p>
            </div>
          )}

          {cargandoVisita && (
            <div className="card p-10 text-center">
              <Loader2 size={18} className="animate-spin mx-auto" style={{ color: CRM_COLOR }} />
              <p className="text-xs text-muted mt-3">Trayendo lo que midió producción…</p>
            </div>
          )}

          {/* ── El formato de la visita, al lado y no dentro ──

              Está aquí para consultarlo mientras se cotiza, no para
              copiarlo a la oferta: las observaciones las lee el cliente
              en el enlace público, y las medidas no se le mandan antes
              que el precio (el mismo criterio que en
              lib/cierre-trabajo.ts). Si el asesor decide que alguna
              línea las lleve, el botón se las pone en el portapapeles. */}
          {visita && (
            <div className="card p-4 sm:p-5" style={{ borderLeft: `4px solid ${CRM_COLOR}` }}>
              <div className="flex items-start gap-3 flex-wrap">
                <Ruler size={18} className="flex-shrink-0 mt-0.5" style={{ color: CRM_COLOR }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-soft">
                    Esta oferta sale de la visita técnica
                    {visita.cuando ? ` del ${visita.cuando}` : ""}
                    {visita.donde ? ` — ${visita.donde}` : ""}
                  </p>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">
                    {visita.cuantos > 0
                      ? `Se cargaron ${visita.cuantos} línea${visita.cuantos === 1 ? "" : "s"} con lo que recomendó producción, en cero: en campo no se ponen precios, los pones tú.`
                      : "Producción no dejó productos recomendados. Agrega las líneas con el formato delante."}
                    {" "}Las medidas se quedan aquí a propósito: las observaciones de la oferta las lee el cliente.
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(visita.resumen)
                      .then(() => toast.success("Formato copiado"))
                      .catch(() => toast.error("No se pudo copiar"));
                  }}
                  className="btn-secondary btn-sm"
                >
                  <Copy size={12} /> Copiar
                </button>
              </div>
              {visita.resumen && (
                <pre
                  className="mt-3 rounded-xl p-3 text-[11.5px] text-soft whitespace-pre-wrap font-sans max-h-64 overflow-y-auto"
                  style={{ backgroundColor: "var(--surface-3)" }}
                >{visita.resumen}</pre>
              )}
            </div>
          )}

          {/* Editar algo que el cliente ya puede estar mirando no es lo
              mismo que corregir un borrador, y quien lo hace tiene que
              saberlo ANTES de tocar los precios, no después. */}
          {editando && original?.estado === "ENVIADA" && (
            <div className="card p-4 flex gap-3" style={{ borderLeft: "4px solid #d97706" }}>
              <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} />
              <div>
                <p className="text-xs font-bold text-soft">Esta oferta ya se le compartió al cliente</p>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  El enlace que tiene muestra siempre la última versión guardada: si la abre después de
                  guardar, va a ver los precios nuevos. Sirve para corregir un error antes de que la mire;
                  para cambiar condiciones ya conversadas, avísele usted.
                </p>
              </div>
            </div>
          )}

          {editando && !cargando && original && !["BORRADOR", "ENVIADA"].includes(original.estado) && (
            <div className="card p-4 flex gap-3" style={{ borderLeft: "4px solid #dc2626" }}>
              <ShieldAlert size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="text-xs font-bold text-soft">Esta cotización ya no se puede editar</p>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  Está en estado <strong>{original.estado}</strong>.
                  {original.estado === "APROBADA"
                    ? " Ya generó un pedido: cambiarle los ítems dejaría el pedido diciendo una cosa y la oferta otra."
                    : " Reescribir una oferta cerrada hace que los informes dejen de significar algo."}
                  {" "}Cree una cotización nueva.
                </p>
              </div>
            </div>
          )}

          {/* ── Dos columnas en pantalla ancha ──

              Antes todo iba en una sola columna de 5xl y el asesor
              cotizaba haciendo scroll: elegía un producto arriba, bajaba
              a ver cómo iba el total, subía otra vez. En un monitor de
              escritorio eso es tirar la mitad del espacio.

              Ahora, a partir de 1280 px: a la izquierda lo que se elige
              (cliente, productos, servicios, sitio), y a la derecha lo
              que se lleva (el carrito y los totales), FIJO en pantalla.
              Se ve el total mientras se agregan líneas, que es la única
              razón por la que alguien miraba abajo.

              Por debajo de 1280 px se apila, en el mismo orden de antes.
              No hay dos diseños: hay uno que se pliega. */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

            {/* ── Lo que se elige ── */}
            <div className="xl:col-span-3 space-y-5 min-w-0">
          {/* Cliente */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Cliente</p>
            {cliente ? (
              <div className="flex items-center gap-3 p-3 rounded-xl surface-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: CRM_COLOR }}>
                  {cliente.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{cliente.nombre}</p>
                  <p className="text-xs text-muted truncate">
                    {[cliente.empresa, cliente.telefono, cliente.ciudad].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button onClick={() => { setCliente(null); setClienteId(""); }} className="text-muted hover:text-red-500"><X size={15} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-9" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente por nombre, empresa o teléfono…" />
                {clientes.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 card p-1 max-h-56 overflow-y-auto">
                    {clientes.map(c => (
                      <button key={c.id} onClick={() => {
                        setCliente(c); setClienteId(c.id); setClienteBusq("");
                        // La ciudad y la direccion del cliente entran solas. Se
                        // pueden cambiar: muchas obras no son en la direccion de
                        // facturacion, y reescribirlas a mano cada vez es como se
                        // llega a la direccion equivocada.
                        if (!ciudadInstalacion && c.ciudad) setCiudadInstalacion(c.ciudad);
                        if (!direccionInstalacion && c.direccion) setDireccionInstalacion(c.direccion);
                      }}
                        className="w-full text-left p-2 rounded-lg hover:brand-bg-10">
                        <p className="text-xs font-semibold text-soft">{c.nombre}</p>
                        <p className="text-[10px] text-muted">{[c.empresa, c.ciudad].filter(Boolean).join(" · ")}</p>
                      </button>
                    ))}
                  </div>
                )}
                <Link href="/crm/clientes/nuevo" className="text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: CRM_COLOR }}>
                  <UserPlus size={12} /> Crear cliente nuevo
                </Link>
              </div>
            )}
          </div>

          {/* Productos */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Productos y servicios</p>

            <div className="relative mb-4">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={buscadorRef}
                className="input pl-9"
                value={prodBusq}
                onChange={e => setProdBusq(e.target.value)}
                placeholder="Buscar producto por nombre o SKU…"
              />
              {productos.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 card p-1 max-h-64 overflow-y-auto">
                  {productos.map(p => (
                    <button key={p.id} onClick={() => agregarProducto(p)} className="w-full text-left p-2 rounded-lg hover:brand-bg-10 flex items-center gap-2">
                      {p.imagenPrincipal
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imagenPrincipal} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded surface-3 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-soft truncate">{p.nombre}</p>
                        <p className="text-[10px] text-muted font-mono">
                          {p.sku} · {p.precioNormal ? formatCOP(p.precioNormal) : "sin precio"}
                          {p.acfFabricacionMedida && <span className="ml-1" style={{ color: CRM_COLOR }}>· a medida</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Trabajo previo con producción ── */}
            <div className="mb-4 p-3 rounded-xl surface-2 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={requiereVisita}
                  onChange={e => setRequiereVisita(e.target.checked)} />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-soft flex items-center gap-1.5">
                    <ClipboardCheck size={12} /> Asignación de visita técnica
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Hay que ir a medir antes de cotizar en firme. Al guardar, al coordinador de
                    producción le llega la solicitud en su módulo de trabajos.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={requiereSgsst}
                  onChange={e => setRequiereSgsst(e.target.checked)} />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-soft flex items-center gap-1.5">
                    <HardHat size={12} /> Proceso de SG-SST requerido
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Habilita al coordinador la carga de documentos por trabajador: cédula, planilla
                    de seguridad social, certificado de alturas, y los coordinadores de SST y alturas.
                  </p>
                </div>
              </label>

              {puedeProbar && (
                <label className="flex items-start gap-2.5 cursor-pointer pt-3 border-t divider">
                  <input type="checkbox" className="mt-0.5" checked={esPrueba}
                    onChange={e => setEsPrueba(e.target.checked)} disabled={editando} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#b45309" }}>
                      <FlaskConical size={12} /> Cotización de prueba
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Lleva numeración aparte (PRUEBA-001), no gasta consecutivo real y queda fuera de
                      informes, embudo y pipeline. La marca se hereda al pedido.
                      {editando && " No se puede cambiar después de crearla."}
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* ── ¿Lleva instalación? ── */}
            <div className="mb-4 p-3 rounded-xl surface-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={incluyeInstalacion}
                  onChange={e => alternarInstalacion(e.target.checked)}
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-soft flex items-center gap-1.5">
                    <Wrench size={12} /> Esta cotización incluye instalación
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Márcalo si además del material se cobra la mano de obra. Sale discriminada en la oferta.
                  </p>
                </div>
              </label>

              {incluyeInstalacion && (
                <div className="mt-3 pt-3 border-t divider space-y-2">
                  {servicios.length > 0 ? (
                    <>
                      <p className="text-[11px] font-semibold text-muted">Elige el servicio</p>
                      <div className="flex flex-wrap gap-1.5">
                        {servicios.map(s => (
                          <button key={s.id} onClick={() => agregarServicio(s)} className="pill text-xs">
                            + {s.nombre} <span className="text-muted">({formatCOP(s.precioBase)}/{s.unidad})</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted">
                      No hay servicios en el catálogo todavía. Se pueden cargar en Configuración → Instalación, o
                      agregar la instalación a mano aquí abajo.
                    </p>
                  )}

                  {/* Hay cerramientos que no se pueden costear en la primera
                      visita. Mejor dejarla escrita en la oferta que omitirla. */}
                  <button onClick={agregarInstalacionLibre} className="pill text-xs">
                    + Instalación a convenir <span className="text-muted">(sin precio por ahora)</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* A dónde va esto.

              Antes el bloque solo salía CON instalación, y se llamaba
              "Sitio de instalación". Pero una cotización sin instalación
              también tiene que ir a alguna parte: la malla se despacha, y
              sin dirección el pedido llega a producción sin saber a dónde.
              Se preguntaba por teléfono o se sacaba de la ficha del
              cliente, que muchas veces es la de facturación y no la de la
              obra.

              Ahora sale siempre y cambia de nombre según lo que sea. No
              son dos campos distintos: es el mismo dato con el nombre que
              le corresponde. */}
          <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-1.5">
                <MapPin size={12} /> {hayInstalacion ? "Dirección de instalación" : "Dirección destino"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Ciudad</label>
                  <input className="input" value={ciudadInstalacion} onChange={e => setCiudadInstalacion(e.target.value)} placeholder="Barranquilla" list="ciudades-recargo" />
                  <datalist id="ciudades-recargo">
                    {ciudades.map(c => <option key={c.id} value={c.ciudad} />)}
                  </datalist>
                  {/* El recargo es por desplazar la cuadrilla: sin
                      instalación no hay cuadrilla que desplazar. */}
                  {hayInstalacion && recargo && (
                    <p className="text-[11px] mt-1 font-semibold" style={{ color: CRM_COLOR }}>
                      Recargo por desplazamiento: {recargo.porcentaje > 0 && `${recargo.porcentaje}%`}
                      {recargo.porcentaje > 0 && recargo.montoFijo > 0 && " + "}
                      {recargo.montoFijo > 0 && formatCOP(recargo.montoFijo)} → {formatCOP(recargoValor)}
                    </p>
                  )}
                  {hayInstalacion && !recargo && ciudadInstalacion.trim().length > 2 && (
                    <p className="text-[11px] text-muted mt-1">Sin recargo configurado para esta ciudad.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    {hayInstalacion ? "Dirección de instalación" : "Dirección destino"}
                  </label>
                  <input className="input" value={direccionInstalacion} onChange={e => setDireccionInstalacion(e.target.value)} placeholder="Km 8 vía Ciénaga, Bodega 4" />
                </div>
              </div>
          </div>

            </div>

            {/* ── Lo que se lleva ──

                `sticky` con `top-4`: al bajar por una lista larga de
                productos, el carrito y el total se quedan a la vista. Sin
                esto, la columna derecha se pierde arriba en cuanto hay
                más de seis líneas y volvemos al problema del scroll. */}
            <div className="xl:col-span-2 space-y-5 min-w-0 xl:sticky xl:top-4">

              <div className="card p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-1.5">
                  <ShoppingCart size={12} /> La cotización
                  {lineas.length > 0 && (
                    <span className="ml-auto normal-case tracking-normal font-semibold text-[11px]">
                      {lineas.length} {lineas.length === 1 ? "línea" : "líneas"}
                    </span>
                  )}
                </p>
              {/* Líneas */}
              {lineas.length === 0 ? (
                <div className="p-6 text-center surface-2 rounded-xl">
                  <Package size={22} className="mx-auto mb-2 text-muted" />
                  <p className="text-xs text-muted mb-3">Todavía no hay nada en la cotización.</p>
                  {/* Antes decía "busca un producto ARRIBA". Con las dos
                      columnas el buscador quedó a la IZQUIERDA, y una
                      instrucción que apunta al sitio equivocado es peor
                      que ninguna: quien la lee busca donde le dicen, no lo
                      encuentra y concluye que el buscador desapareció.
                      Ahora no se explica dónde está: se lleva hasta él. */}
                  <button
                    onClick={irAlBuscador}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ backgroundColor: CRM_COLOR }}
                  >
                    <Search size={13} /> Buscar un producto
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {lineas.map((l, i) => (
                    <div key={i} className="p-3 rounded-xl surface-2" style={l.tipo === "INSTALACION" ? { borderLeft: `3px solid ${CRM_COLOR}` } : undefined}>
                      <div className="flex items-start gap-3">
                        {l.tipo === "INSTALACION" ? (
                          <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CRM_COLOR + "20" }}>
                            <Wrench size={14} style={{ color: CRM_COLOR }} />
                          </div>
                        ) : l.imagenUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.imagenUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded surface-3 flex-shrink-0" />
                        )}
  
                        <div className="flex-1 min-w-0">
                          <input
                            className="input py-1 text-xs font-semibold"
                            value={l.descripcion}
                            onChange={e => actualizar(i, { descripcion: e.target.value })}
                          />
                          {l.puedeMedida && (
                            <label className="flex items-center gap-1.5 text-[11px] text-soft mt-1.5 cursor-pointer">
                              <input type="checkbox" checked={l.aMedida} onChange={e => actualizar(i, { aMedida: e.target.checked, unidad: e.target.checked ? "m2" : "unidad" })} />
                              <Ruler size={11} /> Fabricar a la medida
                            </label>
                          )}
                        </div>
  
                        <button onClick={() => quitar(i)} className="text-muted hover:text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
                      </div>
  
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2.5">
                        {l.aMedida ? (
                          <>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Largo (m)</label>
                              <input type="number" step="0.01" className="input py-1 text-xs" value={l.largo} onChange={e => actualizar(i, { largo: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Ancho (m)</label>
                              <input type="number" step="0.01" className="input py-1 text-xs" value={l.ancho} onChange={e => actualizar(i, { ancho: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Piezas</label>
                              <input type="number" className="input py-1 text-xs" value={l.unidades} onChange={e => actualizar(i, { unidades: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Total m²</label>
                              <div className="input py-1 text-xs font-bold flex items-center" style={{ color: CRM_COLOR }}>{l.cantidad}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Cantidad</label>
                              <input type="number" step="0.01" className="input py-1 text-xs" value={l.cantidad} onChange={e => actualizar(i, { cantidad: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Unidad</label>
                              <input className="input py-1 text-xs" value={l.unidad} onChange={e => actualizar(i, { unidad: e.target.value })} />
                            </div>
                          </>
                        )}
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">V. unitario</label>
                          <input type="number" className="input py-1 text-xs" value={l.precioUnitario} onChange={e => actualizar(i, { precioUnitario: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">
                            Desc. %{l.sinDescuento && <span className="text-[8px] normal-case font-normal"> · no admite</span>}
                          </label>
                          {/* El producto marcado como "sin descuento" no admite
                              rebaja POR LÍNEA (margen mínimo). Sí entra en el
                              descuento global: ese es una decisión sobre el
                              negocio completo, no sobre este producto. */}
                          <input
                            type="number"
                            className="input py-1 text-xs disabled:opacity-40"
                            value={l.descuento}
                            disabled={l.sinDescuento}
                            title={l.sinDescuento ? "Este producto no admite descuento por línea. Sí entra en el descuento global." : undefined}
                            onChange={e => actualizar(i, { descuento: Number(e.target.value) })}
                          />
                        </div>
                        <div className={l.aMedida ? "" : "md:col-span-2"}>
                          <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Subtotal</label>
                          <div className="input py-1 text-xs font-bold flex items-center">
                            {formatCOP(l.cantidad * l.precioUnitario * (1 - l.descuento / 100))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>

          {/* Documento y totales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-5">
            <div className="card p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5"><LayoutTemplate size={12} /> Documento</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { v: "EXPRESS", l: "Express", d: "1-2 hojas" },
                  { v: "PROPUESTA", l: "Propuesta", d: "Dossier completo" },
                ] as const).map(p => (
                  <button key={p.v} onClick={() => setPlantilla(p.v)}
                    className={cn("p-3 rounded-xl text-left transition-all", plantilla === p.v ? "text-white" : "surface-2")}
                    style={plantilla === p.v ? { backgroundColor: CRM_COLOR } : undefined}>
                    <p className="text-xs font-bold flex items-center gap-1.5"><FileText size={12} /> {p.l}</p>
                    <p className={cn("text-[10px] mt-0.5", plantilla === p.v ? "text-white/80" : "text-muted")}>{p.d}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Validez (días)</label>
                <input type="number" className="input max-w-[120px]" value={validezDias} onChange={e => setValidezDias(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Observaciones de esta oferta</label>
                <textarea className="input resize-none" rows={3} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Lo particular de este negocio. Las condiciones comerciales fijas ya salen solas." />
              </div>
            </div>

            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Totales</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-soft"><span>Subtotal</span><span className="font-semibold">{formatCOP(subtotal)}</span></div>
                {valorInstalacion > 0 && (
                  <div className="flex justify-between text-[11px] text-muted"><span>· de eso, instalación</span><span>{formatCOP(valorInstalacion)}</span></div>
                )}
                {recargoValor > 0 && (
                  <div className="flex justify-between text-xs" style={{ color: CRM_COLOR }}><span>Desplazamiento a {ciudadInstalacion}</span><span className="font-semibold">{formatCOP(recargoValor)}</span></div>
                )}
                <div className="flex justify-between items-center text-xs text-soft">
                  <span>Descuento global</span>
                  <div className="flex items-center gap-1">
                    <input type="number" className="input py-0.5 text-xs w-16 text-right" value={descuentoGlobal} onChange={e => setDescuentoGlobal(Number(e.target.value))} />
                    <span className="text-muted">%</span>
                  </div>
                </div>
                {/* ── AIU ── */}
                <div className="pt-2 mt-1 border-t divider">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox" checked={aiuActivo}
                      onChange={e => setAiuActivo(e.target.checked)}
                      className="mt-0.5 accent-[var(--brand-color)]"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-soft">Cotizar como obra (AIU)</span>
                      <span className="block text-[10.5px] text-muted leading-snug mt-0.5">
                        Administración, imprevistos y utilidad sobre el costo directo, material incluido.
                        El IVA pasa a cobrarse <strong>solo sobre la utilidad</strong>: en una obra el
                        material no lleva su 19 % aparte porque ya está dentro del contrato.
                      </span>
                    </span>
                  </label>
                </div>

                {aiuActivo && (
                  <div className="space-y-1.5 p-2.5 rounded-xl surface-2">
                    <p className="text-[10.5px] text-muted">
                      Base (costo directo): <strong className="text-soft">{formatCOP(cuenta.baseAIU)}</strong>
                    </p>
                    {([
                      ["Administración", "admin", cuenta.admin],
                      ["Imprevistos", "imprev", cuenta.imprevistos],
                      ["Utilidad", "utilidad", cuenta.utilidad],
                    ] as const).map(([etiqueta, clave, valor]) => (
                      <div key={clave} className="flex items-center gap-1.5">
                        <span className="text-[11px] text-soft flex-1">{etiqueta}</span>
                        <input
                          type="number" min={0} max={100}
                          className="input py-0.5 text-[11px] w-14 text-right"
                          value={aiuPct[clave]}
                          onChange={e => setAiuPct(v => ({ ...v, [clave]: Number(e.target.value) }))}
                          title="Porcentaje sobre la obra"
                        />
                        <span className="text-muted text-[11px]">%</span>
                        <input
                          type="number" min={0}
                          className="input py-0.5 text-[11px] w-28 text-right"
                          value={aiuMonto[clave]}
                          placeholder={String(Math.round(valor))}
                          onChange={e => setAiuMonto(v => ({ ...v, [clave]: e.target.value }))}
                          title="Monto fijo. Vacío = se calcula del porcentaje."
                        />
                      </div>
                    ))}
                    <p className="text-[10px] text-muted leading-snug pt-0.5">
                      El monto se puede escribir a mano cuando se negocia como suma fija; vacío, sale del
                      porcentaje. Lo que se cobra es el monto.
                    </p>
                  </div>
                )}

                <div className="flex justify-between text-xs text-soft">
                  <span>{aiuActivo ? "IVA 19% sobre la utilidad" : "IVA 19%"}</span>
                  <span className="font-semibold">{formatCOP(iva)}</span>
                </div>
                {aiuActivo && cuenta.subtotalMaterial > 0 && (
                  <div className="flex justify-between text-[10.5px] text-muted">
                    <span>· el material va dentro del costo directo</span>
                    <span>{formatCOP(cuenta.subtotalMaterial)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 mt-1 border-t divider">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Total</span>
                  <span className="text-xl font-black" style={{ color: CRM_COLOR }}>{formatCOP(total)}</span>
                </div>

                {/* Anticipo. Vacío = el mínimo de la política. */}
                <div className="flex justify-between items-center text-xs text-soft pt-2">
                  <span>Anticipo</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" className="input py-0.5 text-xs w-16 text-right" value={anticipoPct}
                      onChange={e => setAnticipoPct(e.target.value)}
                      placeholder={politica ? String(politica.anticipoMinPct) : ""}
                    />
                    <span className="text-muted">%</span>
                  </div>
                </div>
                {anticipoEfectivo != null && (
                  <div className="flex justify-between text-[11px] text-muted">
                    <span>· para iniciar</span>
                    <span>{formatCOP((total * anticipoEfectivo) / 100)}</span>
                  </div>
                )}
              </div>

              {/* Aviso mientras cotiza, no al guardar: si se entera
                  después, ya se lo dijo al cliente por teléfono. */}
              {fueraDePolitica && (
                <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug p-2.5 rounded-lg text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10">
                  <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{fueraDePolitica} Se puede guardar, pero no se podrá enviar hasta que un administrador la autorice.</span>
                </div>
              )}

              <button onClick={() => guardar()} disabled={guardando} className="w-full mt-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar borrador
              </button>
              <p className="text-[11px] text-muted mt-2 text-center">
                Se guarda como borrador. En la cotización podrás imprimirla, mandarla por correo o compartir el enlace.
              </p>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ¿Se lo reenviamos? ──

          Sale al guardar una oferta que el cliente YA tenía. Se pregunta
          en vez de mandarlo solo porque un correo no se deshace, y hay
          ediciones que son un dedazo en una nota interna.

          Y se pregunta SIEMPRE, no solo la primera vez: el correo salía
          cuando la oferta pasaba a ENVIADA y nunca más, así que la
          segunda corrección no le llegaba a nadie y el cliente seguía
          mirando la versión vieja. */}
      {reenviar && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div className="card p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: CRM_COLOR + "1f" }}>
                <Mail size={18} style={{ color: CRM_COLOR }} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-soft">
                  ¿Le reenviamos la {reenviar.numero}?
                </p>
                <p className="text-[12.5px] text-muted mt-1 leading-relaxed">
                  El cliente ya la había recibido. Si no se la reenvías, va a seguir
                  mirando la versión anterior en el correo — aunque el enlace ya muestre
                  esta.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-5">
              <button
                onClick={() => {
                  const id = reenviar.id;
                  setReenviar(null);
                  router.push(`/crm/cotizaciones/${id}`);
                }}
                disabled={reenviando}
                className="btn-secondary btn-sm justify-center sm:w-auto"
              >
                No, solo guardar
              </button>
              <button
                onClick={mandarDeNuevo}
                disabled={reenviando}
                className="px-4 py-2 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: CRM_COLOR }}
              >
                {reenviando ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Sí, reenviar por correo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
