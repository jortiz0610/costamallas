"use client";

// ============================================================
// El documento de la cotización.
//
// Usa el MISMO lenguaje visual de costamallas.com (ver el CSS maestro en
// Files/disenos/costamallas-plantillas.css): amarillo #ffdd00 sobre negro
// #11110f, textura de rayas amarillas en diagonal, esquinas RECTAS,
// títulos en mayúsculas con peso 900. Nada de crema y nada de bordes
// redondeados: la cotización tiene que parecerse a la tienda.
//
// Dos plantillas:
//   EXPRESS   → 1-2 hojas. Producto suelto, que es la mayoría.
//   PROPUESTA → dossier para cerramientos e instalación.
//
// Impresión: cada .hoja corta página y se fuerza print-color-adjust, sin
// lo cual el navegador imprime los fondos negros en blanco y el documento
// pierde toda la marca.
// ============================================================

import { formatCOP } from "@/lib/utils";
import type { ConfigCotizacion } from "@/lib/cotizacion-textos";

// Paleta de la web (costamallas-plantillas.css)
const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";
const CARBON = "#1c1d1a";
const SECCION = "#141311";
const TINTA = "#2b2d29";
const LINEA = "#e2e1d9";
const AMARILLO_TINTA = "#5a5218";

/** Fondo de marca: negro + rayas amarillas + glow en la esquina. */
const RAYAS: React.CSSProperties = {
  background: `radial-gradient(85% 120% at 100% 0%, rgba(255,221,0,.20), transparent 55%),
    repeating-linear-gradient(135deg, rgba(255,221,0,.10) 0 2px, transparent 2px 22px),
    ${SECCION}`,
};

export interface ItemDoc {
  descripcion: string;
  detalle?: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  unidad?: string | null;
  tipo?: string | null;          // PRODUCTO | INSTALACION
  imagenUrl?: string | null;
}

export interface CotizacionDocData {
  numero: string;
  createdAt?: string;
  validezDias?: number | null;
  notas?: string | null;
  subtotal: number;
  descuento?: number;
  iva?: number;
  total: number;
  plantilla?: string | null;
  ciudadInstalacion?: string | null;
  direccionInstalacion?: string | null;
  cliente: {
    nombre: string; empresa?: string | null; email?: string | null; telefono?: string | null;
    ciudad?: string | null; direccion?: string | null; nit?: string | null;
  };
  items: ItemDoc[];
  vendedor?: { nombre: string; email?: string | null; telefono?: string | null } | null;
}

export interface BrandInfo {
  companyName: string; brandColor: string; legalName?: string; nit?: string;
  address?: string; phone?: string; email?: string; logoUrl?: string | null;
}

// ── Piezas de marca ──────────────────────────────────────────

/** Píldora negra con texto amarillo. Es el `.cm-eyebrow` de la web. */
function Ceja({ children, invertida = false }: { children: React.ReactNode; invertida?: boolean }) {
  return (
    <span
      className="inline-flex items-center px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em]"
      style={{
        borderRadius: 999,
        backgroundColor: invertida ? AMARILLO : NEGRO,
        color: invertida ? NEGRO : AMARILLO,
      }}
    >
      {children}
    </span>
  );
}

/** Título de sección: barra amarilla gruesa + texto negro en mayúsculas. */
function Titulo({ children, claro = false, tam = "22px" }: { children: React.ReactNode; claro?: boolean; tam?: string }) {
  return (
    <div className="mb-5">
      <div className="w-12 h-1.5 mb-3" style={{ backgroundColor: AMARILLO }} />
      <h2
        className="font-black uppercase leading-[0.95] tracking-[-0.01em] m-0"
        style={{ color: claro ? "#fff" : NEGRO, fontSize: tam }}
      >
        {children}
      </h2>
    </div>
  );
}

/** Etiqueta pequeña sobre un dato. */
function Rotulo({ children, claro = false }: { children: React.ReactNode; claro?: boolean }) {
  return (
    <p className="text-[8.5px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: claro ? AMARILLO : AMARILLO_TINTA }}>
      {children}
    </p>
  );
}

function Parrafo({ children, claro = false }: { children: React.ReactNode; claro?: boolean }) {
  return (
    <p className="text-[10.5px] leading-[1.65] whitespace-pre-line m-0" style={{ color: claro ? "rgba(255,255,255,.72)" : TINTA }}>
      {children}
    </p>
  );
}

/** Viñeta con el cuadrito amarillo inclinado de la web. */
function Punto({ children, claro = false }: { children: React.ReactNode; claro?: boolean }) {
  return (
    <li className="relative pl-6 py-1.5 text-[10.5px] leading-[1.55] font-semibold" style={{ color: claro ? "rgba(255,255,255,.85)" : TINTA }}>
      <span className="absolute left-0 top-[9px] w-3 h-3" style={{ backgroundColor: AMARILLO, transform: "skewX(-8deg)" }} />
      {children}
    </li>
  );
}

/** Divide un texto largo en viñetas por comas o punto y coma. */
function listar(texto: string): string[] {
  return texto
    .split(/\.\s+|(?<!\d)[;·]\s*/)
    .map(t => t.trim().replace(/\.$/, ""))
    .filter(t => t.length > 3);
}

function Hoja({ children, ultima = false, oscura = false }: { children: React.ReactNode; ultima?: boolean; oscura?: boolean }) {
  return (
    <section
      className="relative"
      style={{
        breakAfter: ultima ? "auto" : "page",
        minHeight: "297mm",
        backgroundColor: oscura ? SECCION : "#fff",
        ...(oscura ? RAYAS : {}),
      }}
    >
      {children}
    </section>
  );
}

/** Franja oscura con rayas; si hay foto, la foto manda. */
function Franja({ url, children, alto, className = "" }: {
  url?: string; children?: React.ReactNode; alto: string; className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ minHeight: alto, ...RAYAS }}>
      {url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(17,17,15,.45), rgba(17,17,15,.92))" }} />
        </>
      )}
      {/* Línea amarilla superior, como las secciones oscuras de la tienda */}
      <div className="absolute left-0 right-0 top-0" style={{ height: 3, background: `linear-gradient(90deg, transparent, ${AMARILLO}, transparent)` }} />
      <div className="relative">{children}</div>
    </div>
  );
}

// ── Tabla de la oferta ───────────────────────────────────────
function TablaItems({ items, conFoto }: { items: ItemDoc[]; conFoto: boolean }) {
  return (
    <table className="w-full" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ backgroundColor: NEGRO }}>
          {conFoto && <th className="w-[54px]" style={{ borderTop: `3px solid ${AMARILLO}` }} />}
          <th className="text-left py-3 px-3 text-[8.5px] font-black uppercase tracking-[0.14em] text-white" style={{ borderTop: `3px solid ${AMARILLO}` }}>Descripción</th>
          <th className="text-center py-3 px-2 text-[8.5px] font-black uppercase tracking-[0.14em] w-24" style={{ color: AMARILLO, borderTop: `3px solid ${AMARILLO}` }}>Cantidad</th>
          <th className="text-right py-3 px-2 text-[8.5px] font-black uppercase tracking-[0.14em] text-white w-28" style={{ borderTop: `3px solid ${AMARILLO}` }}>V. Unitario</th>
          <th className="text-right py-3 px-3 text-[8.5px] font-black uppercase tracking-[0.14em] w-28" style={{ color: AMARILLO, borderTop: `3px solid ${AMARILLO}` }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => {
          const servicio = it.tipo === "INSTALACION";
          return (
            <tr key={i} style={{ borderBottom: `1px solid ${LINEA}`, backgroundColor: servicio ? "rgba(255,221,0,.16)" : undefined }}>
              {conFoto && (
                <td className="py-2 pl-3">
                  {it.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imagenUrl} alt="" className="w-11 h-11 object-cover" style={{ border: `2px solid ${AMARILLO}` }} />
                  ) : (
                    <div className="w-11 h-11" style={{ ...RAYAS, border: `2px solid ${AMARILLO}` }} />
                  )}
                </td>
              )}
              <td className="py-3 px-3">
                {servicio && (
                  <span className="inline-block text-[7.5px] font-black uppercase tracking-[0.1em] px-2 py-0.5 mb-1" style={{ backgroundColor: NEGRO, color: AMARILLO }}>
                    Servicio de instalación
                  </span>
                )}
                <p className="text-[10.5px] font-black uppercase leading-tight m-0" style={{ color: NEGRO }}>{it.descripcion}</p>
                {it.detalle && <p className="text-[9.5px] mt-1 m-0 whitespace-pre-line" style={{ color: "#6b6f6a" }}>{it.detalle}</p>}
              </td>
              <td className="py-3 px-2 text-center text-[10.5px] font-bold whitespace-nowrap" style={{ color: TINTA }}>
                {Number(it.cantidad).toLocaleString("es-CO")}
                {it.unidad ? <span className="font-normal text-[9px]"> {it.unidad}</span> : null}
              </td>
              <td className="py-3 px-2 text-right text-[10.5px] whitespace-nowrap" style={{ color: TINTA }}>{formatCOP(Number(it.precioUnitario))}</td>
              <td className="py-3 px-3 text-right text-[11px] font-black whitespace-nowrap" style={{ color: NEGRO }}>{formatCOP(Number(it.subtotal))}</td>
            </tr>
          );
        })}
        {items.length === 0 && (
          <tr><td colSpan={conFoto ? 5 : 4} className="py-8 text-center text-[10px]" style={{ color: "#9a9a92" }}>Sin ítems</td></tr>
        )}
      </tbody>
    </table>
  );
}

function Totales({ data, grande = false }: { data: CotizacionDocData; grande?: boolean }) {
  return (
    <div className={grande ? "w-full" : "w-80 ml-auto"}>
      <div className="px-4 py-3 space-y-1.5" style={{ backgroundColor: "#f7f6f0" }}>
        <div className="flex justify-between text-[10.5px]" style={{ color: TINTA }}><span>Subtotal</span><span className="font-bold">{formatCOP(Number(data.subtotal))}</span></div>
        {!!data.descuento && data.descuento > 0 && (
          <div className="flex justify-between text-[10.5px]" style={{ color: TINTA }}><span>Descuento</span><span className="font-bold">− {formatCOP(Number(data.descuento))}</span></div>
        )}
        {!!data.iva && data.iva > 0 && (
          <div className="flex justify-between text-[10.5px]" style={{ color: TINTA }}><span>IVA 19%</span><span className="font-bold">{formatCOP(Number(data.iva))}</span></div>
        )}
      </div>
      <div className="relative overflow-hidden" style={RAYAS}>
        <div className="absolute left-0 right-0 top-0" style={{ height: 3, backgroundColor: AMARILLO }} />
        <div className={`relative flex justify-between items-center px-5 ${grande ? "py-6" : "py-4"}`}>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Total a pagar</span>
          <span className="font-black leading-none" style={{ color: AMARILLO, fontSize: grande ? "34px" : "22px" }}>
            {formatCOP(Number(data.total))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Documento ────────────────────────────────────────────────
export function CotizacionDoc({ data, brand, config }: {
  data: CotizacionDocData; brand: BrandInfo; config: ConfigCotizacion;
}) {
  const fecha = data.createdAt ? new Date(data.createdAt) : new Date();
  const validez = data.validezDias ?? config.validezDias ?? 3;
  const vence = new Date(fecha.getTime() + validez * 86400000);
  const c = data.cliente;
  const esPropuesta = data.plantilla === "PROPUESTA";
  const instalaciones = data.items.filter(i => i.tipo === "INSTALACION");
  const fmt = (d: Date) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  const ciudadEmpresa = brand.address?.split(",").pop()?.trim() || "Barranquilla";

  const Logo = ({ invertido = false, alto = "h-9" }: { invertido?: boolean; alto?: string }) =>
    brand.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logoUrl} alt={brand.companyName} className={`${alto} object-contain`} style={invertido ? { filter: "brightness(0) invert(1)" } : undefined} />
    ) : (
      <span className="text-xl font-black uppercase tracking-tight" style={{ color: invertido ? "#fff" : NEGRO }}>{brand.companyName}</span>
    );

  const Pie = ({ oscuro = false }: { oscuro?: boolean }) => (
    <p className="text-[8px] uppercase tracking-[0.08em] font-bold m-0" style={{ color: oscuro ? "rgba(255,255,255,.45)" : "#9a9a92" }}>
      {[brand.address, brand.phone, brand.email, "costamallas.com"].filter(Boolean).join("   ·   ")}
    </p>
  );

  /** Cabecera de las hojas interiores: negro con línea amarilla. */
  const Cabecera = () => (
    <div className="relative overflow-hidden" style={{ backgroundColor: NEGRO }}>
      <div className="absolute left-0 right-0 bottom-0" style={{ height: 3, backgroundColor: AMARILLO }} />
      <div className="relative px-12 py-5 flex items-center justify-between">
        <Logo invertido alto="h-7" />
        <div className="flex items-center gap-3">
          <span className="text-[8.5px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.45)" }}>Cotización</span>
          <span className="px-2.5 py-1 text-[10px] font-black" style={{ backgroundColor: AMARILLO, color: NEGRO }}>{data.numero}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="mx-auto"
      style={{
        width: "100%", maxWidth: "210mm", backgroundColor: "#fff",
        fontFamily: "Inter, 'Segoe UI', Arial, sans-serif",
        WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
      }}
    >
      {/* Sin márgenes de impresora (portadas a sangre) y sin que el navegador
          descarte los fondos oscuros al imprimir, que es lo que por defecto hace. */}
      <style media="print">{`
        @page { size: A4; margin: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      `}</style>

      {/* ───────── PORTADA ───────── */}
      {esPropuesta && (
        <Hoja>
          <div className="relative overflow-hidden" style={{ minHeight: "297mm", backgroundColor: NEGRO }}>
            {/* Bloque amarillo diagonal, como el hero de la tienda */}
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(158deg, ${AMARILLO} 0 46%, transparent 46%)` }}
            />
            {config.imgPortada && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.imgPortada} alt="" className="absolute left-0 right-0 bottom-0 w-full object-cover" style={{ height: "56%" }} />
                <div className="absolute left-0 right-0 bottom-0" style={{ height: "56%", background: "linear-gradient(180deg, rgba(17,17,15,.35), rgba(17,17,15,.92))" }} />
              </>
            )}
            <div className="absolute inset-0" style={{ ...RAYAS, opacity: config.imgPortada ? 0 : 0.55, top: "46%" }} />

            <div className="relative flex flex-col justify-between p-14" style={{ minHeight: "297mm" }}>
              <div className="flex items-start justify-between">
                <Logo />
                <span className="px-3 py-1.5 text-[10px] font-black" style={{ backgroundColor: NEGRO, color: AMARILLO }}>{data.numero}</span>
              </div>

              <div style={{ marginTop: "-14%" }}>
                <Ceja>Más de 12 años protegiendo</Ceja>
                <h1 className="font-black uppercase leading-[0.86] tracking-[-0.02em] mt-5 m-0" style={{ color: NEGRO, fontSize: "62px" }}>
                  Propuesta<br />comercial
                </h1>
                <p className="text-[12px] font-bold mt-4 max-w-sm leading-snug m-0" style={{ color: AMARILLO_TINTA }}>
                  Mallas, cerramientos y seguridad perimetral. Fabricación propia
                  e instalación con personal certificado en alturas.
                </p>
              </div>

              <div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4" style={{ backgroundColor: "rgba(255,255,255,.06)", borderTop: `3px solid ${AMARILLO}` }}>
                    <Rotulo claro>Preparada para</Rotulo>
                    <p className="text-white text-[12px] font-black uppercase leading-tight m-0">{c.empresa || c.nombre}</p>
                    {c.empresa && <p className="text-[10px] m-0" style={{ color: "rgba(255,255,255,.55)" }}>{c.nombre}</p>}
                  </div>
                  <div className="p-4" style={{ backgroundColor: "rgba(255,255,255,.06)", borderTop: `3px solid ${AMARILLO}` }}>
                    <Rotulo claro>Fecha</Rotulo>
                    <p className="text-white text-[12px] font-bold m-0">{fmt(fecha)}</p>
                  </div>
                  <div className="p-4" style={{ backgroundColor: "rgba(255,255,255,.06)", borderTop: `3px solid ${AMARILLO}` }}>
                    <Rotulo claro>Válida hasta</Rotulo>
                    <p className="text-[12px] font-black m-0" style={{ color: AMARILLO }}>{fmt(vence)}</p>
                  </div>
                </div>
                <div className="mt-6"><Pie oscuro /></div>
              </div>
            </div>
          </div>
        </Hoja>
      )}

      {/* ───────── CARTA ───────── */}
      {esPropuesta && (
        <Hoja>
          <Cabecera />
          <div className="px-12 pt-10">
            <Ceja>{ciudadEmpresa}, {fmt(fecha)}</Ceja>
            <div className="mt-6">
              <Titulo tam="26px">Estimado(a)<br />{c.nombre}</Titulo>
            </div>
            <div className="space-y-3.5 max-w-[150mm]">
              <Parrafo>
                Le agradecemos la oportunidad de presentarle nuestra propuesta. A continuación encontrará el
                detalle de la oferta comercial preparada según lo que conversamos.
              </Parrafo>
              <Parrafo>{config.carta}</Parrafo>
              <Parrafo>Quedamos atentos a cualquier ajuste que requiera para avanzar en el proceso.</Parrafo>
            </div>

            <div className="mt-10 inline-block px-6 py-4" style={{ borderLeft: `6px solid ${AMARILLO}`, backgroundColor: "#f7f6f0" }}>
              <p className="text-[13px] font-black uppercase m-0" style={{ color: NEGRO }}>{data.vendedor?.nombre ?? brand.companyName}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide m-0" style={{ color: AMARILLO_TINTA }}>Asesor comercial · {brand.companyName}</p>
              <p className="text-[10px] mt-1 m-0" style={{ color: TINTA }}>
                {[data.vendedor?.telefono || brand.phone, data.vendedor?.email || brand.email].filter(Boolean).join("   ·   ")}
              </p>
            </div>
          </div>

          <div className="px-12 mt-10">
            <Franja url={config.imgBanda} alto="170px">
              <div className="p-8 flex items-end" style={{ minHeight: "170px" }}>
                <div>
                  <Ceja invertida>Fabricantes e importadores</Ceja>
                  <p className="text-white text-2xl font-black uppercase leading-[0.95] mt-3 m-0">
                    Fabricamos, importamos<br />e instalamos.
                  </p>
                </div>
              </div>
            </Franja>
          </div>
        </Hoja>
      )}

      {/* ───────── OFERTA ───────── */}
      <Hoja>
        {esPropuesta ? <Cabecera /> : (
          /* Express: cabecera partida amarillo/negro */
          <div className="relative overflow-hidden" style={{ backgroundColor: NEGRO }}>
            <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${AMARILLO} 0 42%, transparent 42%)` }} />
            <div className="absolute inset-0" style={{ ...RAYAS, opacity: .5, left: "42%" }} />
            <div className="relative px-10 py-8 flex items-start justify-between">
              <div>
                <Logo />
                <p className="text-[9px] font-bold uppercase tracking-wide mt-2 m-0" style={{ color: AMARILLO_TINTA }}>
                  {brand.legalName || brand.companyName}{brand.nit ? ` · NIT ${brand.nit}` : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] mb-2" style={{ backgroundColor: AMARILLO, color: NEGRO }}>
                  Cotización
                </span>
                <p className="text-white font-black text-xl leading-none m-0">{data.numero}</p>
                <p className="text-[9.5px] mt-1.5 m-0" style={{ color: "rgba(255,255,255,.55)" }}>{fmt(fecha)}</p>
                <p className="text-[9.5px] font-bold m-0" style={{ color: AMARILLO }}>Válida hasta {fmt(vence)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ficha de datos */}
        <div className="px-12 py-7 grid grid-cols-2 gap-x-8 gap-y-5">
          <div className="p-4" style={{ backgroundColor: "#f7f6f0", borderLeft: `4px solid ${AMARILLO}` }}>
            <Rotulo>Datos del cliente</Rotulo>
            <p className="text-[12px] font-black uppercase m-0" style={{ color: NEGRO }}>{c.nombre}</p>
            {c.empresa && <p className="text-[10px] font-bold m-0" style={{ color: TINTA }}>{c.empresa}</p>}
            {c.nit && <p className="text-[10px] m-0" style={{ color: TINTA }}>NIT/CC: {c.nit}</p>}
            <p className="text-[10px] m-0" style={{ color: TINTA }}>{[c.telefono, c.email].filter(Boolean).join(" · ")}</p>
            {(c.direccion || c.ciudad) && <p className="text-[10px] m-0" style={{ color: TINTA }}>{[c.direccion, c.ciudad].filter(Boolean).join(", ")}</p>}
          </div>

          {(data.direccionInstalacion || data.ciudadInstalacion) ? (
            <div className="p-4" style={{ backgroundColor: NEGRO, borderLeft: `4px solid ${AMARILLO}` }}>
              <Rotulo claro>Sitio de instalación</Rotulo>
              <p className="text-white text-[11px] font-bold m-0">{data.direccionInstalacion}</p>
              {data.ciudadInstalacion && <p className="text-[11px] font-black uppercase m-0" style={{ color: AMARILLO }}>{data.ciudadInstalacion}</p>}
            </div>
          ) : (
            <div className="p-4" style={{ backgroundColor: "#f7f6f0", borderLeft: `4px solid ${AMARILLO}` }}>
              <Rotulo>Emitida por</Rotulo>
              <p className="text-[12px] font-black uppercase m-0" style={{ color: NEGRO }}>{brand.companyName}</p>
              {brand.address && <p className="text-[10px] m-0" style={{ color: TINTA }}>{brand.address}</p>}
              <p className="text-[10px] m-0" style={{ color: TINTA }}>{[brand.phone, brand.email].filter(Boolean).join(" · ")}</p>
            </div>
          )}

          <div>
            <Rotulo>Asesor</Rotulo>
            <p className="text-[11px] font-bold m-0" style={{ color: NEGRO }}>{data.vendedor?.nombre ?? "—"}</p>
            {(data.vendedor?.telefono || data.vendedor?.email) && (
              <p className="text-[10px] m-0" style={{ color: TINTA }}>{[data.vendedor?.telefono, data.vendedor?.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div>
            <Rotulo>Validez de la oferta</Rotulo>
            <p className="text-[11px] font-bold m-0" style={{ color: NEGRO }}>{validez} día{validez === 1 ? "" : "s"} — hasta el {fmt(vence)}</p>
            <p className="text-[9.5px] m-0" style={{ color: "#6b6f6a" }}>{config.vigencia}</p>
          </div>
        </div>

        {/* Ítems */}
        <div className="px-12">
          <Titulo>Oferta comercial</Titulo>
          <TablaItems items={data.items} conFoto />
          <div className="mt-5"><Totales data={data} /></div>

          {data.notas && (
            <div className="mt-6 p-4" style={{ backgroundColor: "#f7f6f0", borderLeft: `4px solid ${AMARILLO}` }}>
              <Rotulo>Observaciones de esta oferta</Rotulo>
              <Parrafo>{data.notas}</Parrafo>
            </div>
          )}
        </div>

        {/* Express: condiciones en la misma hoja */}
        {!esPropuesta && (
          <div className="px-12 mt-8 pb-10">
            <Titulo tam="18px">Condiciones comerciales</Titulo>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div><Rotulo>Forma de pago</Rotulo><Parrafo>{config.formaPago}</Parrafo></div>
              <div><Rotulo>Tiempo de entrega</Rotulo><Parrafo>{config.tiempoEntrega}</Parrafo></div>
              <div className="col-span-2 p-4" style={{ backgroundColor: NEGRO }}>
                <Rotulo claro>Información de pago</Rotulo><Parrafo claro>{config.infoPago}</Parrafo>
              </div>
              <div className="col-span-2"><Rotulo>Observaciones</Rotulo><Parrafo>{config.observaciones}</Parrafo></div>
              <div className="col-span-2"><Rotulo>Sitio de entrega</Rotulo><Parrafo>{config.sitioEntrega}</Parrafo></div>
              <div className="col-span-2"><Rotulo>Garantía</Rotulo><Parrafo>{config.garantia}</Parrafo></div>
              {instalaciones.length > 0 && (
                <>
                  <div className="col-span-2"><Rotulo>La instalación incluye</Rotulo><Parrafo>{config.instalacionIncluye}</Parrafo></div>
                  <div className="col-span-2"><Rotulo>El cliente debe suministrar</Rotulo><Parrafo>{config.instalacionRequiere}</Parrafo></div>
                </>
              )}
              <div className="col-span-2"><Rotulo>Políticas de compra y devolución</Rotulo><Parrafo>{config.politicas}</Parrafo></div>
            </div>

            {config.qrPagos.length > 0 && (
              <div className="mt-6 flex gap-4">
                {config.qrPagos.map((q, i) => (
                  <div key={i} className="text-center p-2" style={{ border: `2px solid ${AMARILLO}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.url} alt={q.etiqueta} className="w-20 h-20 object-contain" />
                    <p className="text-[8px] font-black uppercase mt-1 m-0" style={{ color: AMARILLO_TINTA }}>{q.etiqueta}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-4 flex items-center justify-between" style={{ borderTop: `2px solid ${AMARILLO}` }}>
              <Pie />
              <p className="text-[8px] font-black uppercase m-0" style={{ color: "#9a9a92" }}>Atendido por {data.vendedor?.nombre ?? brand.companyName}</p>
            </div>
          </div>
        )}
      </Hoja>

      {/* ───────── INSTALACIÓN ───────── */}
      {esPropuesta && instalaciones.length > 0 && (
        <Hoja>
          <Franja url={config.imgInstalacion} alto="250px">
            <div className="p-12 flex flex-col justify-end" style={{ minHeight: "250px" }}>
              <Ceja invertida>Personal certificado</Ceja>
              <h2 className="text-white text-4xl font-black uppercase leading-[0.9] mt-4 m-0">El servicio<br />de instalación</h2>
              <p className="text-[10.5px] font-bold uppercase tracking-wide mt-3 m-0" style={{ color: AMARILLO }}>
                Trabajo en alturas · SG-SST · ISO 9001
              </p>
            </div>
          </Franja>

          <div className="px-12 py-10 grid grid-cols-2 gap-8">
            <div>
              <div className="px-4 py-2.5 mb-3" style={{ backgroundColor: AMARILLO }}>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] m-0" style={{ color: NEGRO }}>Nuestra oferta incluye</p>
              </div>
              <ul className="m-0 p-0 list-none">
                {listar(config.instalacionIncluye).map((t, i) => <Punto key={i}>{t}</Punto>)}
              </ul>
            </div>
            <div>
              <div className="px-4 py-2.5 mb-3" style={{ backgroundColor: NEGRO }}>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] m-0" style={{ color: AMARILLO }}>El cliente debe suministrar</p>
              </div>
              <ul className="m-0 p-0 list-none">
                {listar(config.instalacionRequiere).map((t, i) => <Punto key={i}>{t}</Punto>)}
              </ul>
            </div>
          </div>

          <div className="px-12">
            <Titulo tam="18px">Servicios cotizados</Titulo>
            <TablaItems items={instalaciones} conFoto={false} />
          </div>
        </Hoja>
      )}

      {/* ───────── RESUMEN Y PAGO ───────── */}
      {esPropuesta && (
        <Hoja>
          <Cabecera />
          <div className="px-12 pt-10">
            <Titulo>Resumen de la oferta</Titulo>
            <Totales data={data} grande />

            <div className="mt-8 p-6" style={{ backgroundColor: NEGRO }}>
              <Rotulo claro>Información de pago</Rotulo>
              <Parrafo claro>{config.infoPago}</Parrafo>

              {config.qrPagos.length > 0 && (
                <div className="mt-5 flex gap-4">
                  {config.qrPagos.map((q, i) => (
                    <div key={i} className="text-center p-2" style={{ backgroundColor: "#fff" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.url} alt={q.etiqueta} className="w-24 h-24 object-contain" />
                      <p className="text-[8px] font-black uppercase mt-1 m-0" style={{ color: AMARILLO_TINTA }}>{q.etiqueta}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6">
              <div className="p-4" style={{ backgroundColor: "#f7f6f0", borderLeft: `4px solid ${AMARILLO}` }}>
                <Rotulo>Forma de pago</Rotulo><Parrafo>{config.formaPago}</Parrafo>
              </div>
              <div className="p-4" style={{ backgroundColor: "#f7f6f0", borderLeft: `4px solid ${AMARILLO}` }}>
                <Rotulo>Tiempo de entrega</Rotulo><Parrafo>{config.tiempoEntrega}</Parrafo>
              </div>
            </div>

            <div className="mt-10 p-7 relative overflow-hidden" style={{ backgroundColor: AMARILLO }}>
              <p className="text-2xl font-black uppercase leading-none m-0" style={{ color: NEGRO }}>¿Avanzamos?</p>
              <p className="text-[11px] font-semibold mt-2 max-w-md m-0" style={{ color: AMARILLO_TINTA }}>
                Confirme esta oferta respondiendo a este correo o al WhatsApp de su asesor y apartamos el material.
                Válida hasta el {fmt(vence)}.
              </p>
              <p className="text-[13px] font-black mt-4 m-0" style={{ color: NEGRO }}>
                {[data.vendedor?.telefono || brand.phone, data.vendedor?.email || brand.email].filter(Boolean).join("   ·   ")}
              </p>
            </div>
          </div>
        </Hoja>
      )}

      {/* ───────── CONDICIONES ───────── */}
      {esPropuesta && (
        <Hoja>
          <Cabecera />
          <div className="px-12 pt-10 space-y-5">
            <Titulo>Condiciones comerciales</Titulo>
            {[
              ["Observaciones", config.observaciones],
              ["Sitio de entrega", config.sitioEntrega],
              ["Garantía", config.garantia],
              ["Políticas de compra y devolución", config.politicas],
              ["Vigencia", config.vigencia],
            ].map(([titulo, texto]) => (
              <div key={titulo} className="pl-4" style={{ borderLeft: `4px solid ${AMARILLO}` }}>
                <Rotulo>{titulo}</Rotulo>
                <Parrafo>{texto}</Parrafo>
              </div>
            ))}
          </div>
        </Hoja>
      )}

      {/* ───────── CONTRAPORTADA ───────── */}
      {esPropuesta && (
        <Hoja ultima>
          <div className="relative overflow-hidden" style={{ minHeight: "297mm", ...RAYAS }}>
            {config.imgContraportada && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.imgContraportada} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(17,17,15,.55), rgba(17,17,15,.95))" }} />
              </>
            )}
            <div className="relative flex flex-col justify-between p-14" style={{ minHeight: "297mm" }}>
              <Logo invertido />
              <div>
                <div className="w-16 h-1.5 mb-5" style={{ backgroundColor: AMARILLO }} />
                <p className="text-white text-4xl font-black uppercase leading-[0.9] m-0">Gracias por<br />considerarnos.</p>
                <p className="text-[11px] mt-5 max-w-sm leading-relaxed m-0" style={{ color: "rgba(255,255,255,.6)" }}>
                  Estamos atentos a cualquier ajuste que necesite para avanzar.
                </p>
                <div className="mt-8 inline-block px-5 py-4" style={{ borderLeft: `5px solid ${AMARILLO}`, backgroundColor: "rgba(255,255,255,.05)" }}>
                  <p className="text-white text-[13px] font-black uppercase m-0">{data.vendedor?.nombre ?? brand.companyName}</p>
                  <p className="text-[12px] font-bold mt-0.5 m-0" style={{ color: AMARILLO }}>
                    {[data.vendedor?.telefono || brand.phone, data.vendedor?.email || brand.email].filter(Boolean).join("   ·   ")}
                  </p>
                </div>
              </div>
              <div>
                <Pie oscuro />
                <p className="text-[7.5px] mt-2 m-0" style={{ color: "rgba(255,255,255,.3)" }}>Imágenes de referencia.</p>
              </div>
            </div>
          </div>
        </Hoja>
      )}
    </div>
  );
}
