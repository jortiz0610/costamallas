"use client";

import { formatCOP } from "@/lib/utils";
import type { BrandInfo } from "@/components/crm/CotizacionPDF";

export interface FacturaPDFData {
  numero: string; prefijo?: string | null; consecutivo?: number | null;
  createdAt?: string; fechaVence?: string | null; estado: string;
  estadoDian: string; cufe?: string | null;
  subtotal: number; descuento?: number; iva: number; total: number; saldoPendiente?: number;
  notas?: string | null;
  cliente: { nombre: string; empresa?: string | null; email?: string | null; telefono?: string | null; ciudad?: string | null; direccion?: string | null; nit?: string | null };
  items: { descripcion: string; cantidad: number; precioUnitario: number; ivaPct?: number; subtotal: number; unidad?: string | null }[];
}

export function FacturaPDF({ data, brand }: { data: FacturaPDFData; brand: BrandInfo }) {
  const fecha = data.createdAt ? new Date(data.createdAt) : new Date();
  const c = data.cliente;
  const numeroFull = data.prefijo && data.consecutivo ? `${data.prefijo}-${data.consecutivo}` : data.numero;

  return (
    <div className="bg-white text-gray-900 mx-auto shadow-lg print:shadow-none" style={{ width: "100%", maxWidth: "800px", fontFamily: "Inter, sans-serif" }}>
      <div className="px-10 py-7 flex items-start justify-between" style={{ background: `linear-gradient(135deg, ${brand.brandColor}, ${brand.brandColor}cc)` }}>
        <div>
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.companyName} className="h-12 object-contain mb-2 brightness-0 invert" />
            : <div className="text-2xl font-black text-white mb-1">{brand.companyName}</div>}
          <p className="text-white/80 text-xs">{brand.legalName || brand.companyName}</p>
          {brand.nit && <p className="text-white/60 text-[11px]">NIT: {brand.nit}</p>}
          {brand.address && <p className="text-white/60 text-[11px]">{brand.address}</p>}
        </div>
        <div className="text-right">
          <div className="inline-block bg-white/20 backdrop-blur rounded-lg px-4 py-1.5 mb-2">
            <p className="text-white font-black text-lg tracking-wide">FACTURA DE VENTA</p>
          </div>
          <p className="text-white text-sm font-bold">{numeroFull}</p>
          <p className="text-white/70 text-[11px] mt-0.5">Fecha: {fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</p>
          {data.fechaVence && <p className="text-white/70 text-[11px]">Vence: {new Date(data.fechaVence).toLocaleDateString("es-CO")}</p>}
          {data.estadoDian !== "NO_APLICA" && <p className="text-white/70 text-[11px]">DIAN: {data.estadoDian}</p>}
        </div>
      </div>

      <div className="px-10 py-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: brand.brandColor }}>Emisor</p>
          <p className="text-sm font-bold text-gray-800">{brand.companyName}</p>
          <p className="text-xs text-gray-600">{[brand.phone, brand.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: brand.brandColor }}>Cliente</p>
          <p className="text-sm font-bold text-gray-800">{c.nombre}</p>
          {c.empresa && <p className="text-xs text-gray-600">{c.empresa}</p>}
          {c.nit && <p className="text-xs text-gray-600">NIT/CC: {c.nit}</p>}
          <p className="text-xs text-gray-600">{[c.telefono, c.email].filter(Boolean).join(" · ")}</p>
          {(c.direccion || c.ciudad) && <p className="text-xs text-gray-600">{[c.direccion, c.ciudad].filter(Boolean).join(", ")}</p>}
        </div>
      </div>

      <div className="px-10">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: brand.brandColor + "15", borderBottom: `2px solid ${brand.brandColor}` }}>
              <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase text-gray-700">Descripción</th>
              <th className="text-center py-2.5 px-2 text-[11px] font-bold uppercase text-gray-700 w-16">Cant.</th>
              <th className="text-right py-2.5 px-2 text-[11px] font-bold uppercase text-gray-700 w-28">V. Unit.</th>
              <th className="text-center py-2.5 px-2 text-[11px] font-bold uppercase text-gray-700 w-14">IVA</th>
              <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase text-gray-700 w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2.5 px-3 text-gray-800">{it.descripcion}</td>
                <td className="py-2.5 px-2 text-center text-gray-600">{it.cantidad}{it.unidad ? ` ${it.unidad}` : ""}</td>
                <td className="py-2.5 px-2 text-right text-gray-600">{formatCOP(Number(it.precioUnitario))}</td>
                <td className="py-2.5 px-2 text-center text-gray-500">{it.ivaPct ?? 19}%</td>
                <td className="py-2.5 px-3 text-right font-semibold text-gray-800">{formatCOP(Number(it.subtotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-10 py-5 flex justify-end">
        <div className="w-64 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCOP(Number(data.subtotal))}</span></div>
          {!!data.descuento && data.descuento > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Descuento</span><span>- {formatCOP(Number(data.descuento))}</span></div>}
          <div className="flex justify-between text-sm text-gray-600"><span>IVA</span><span>{formatCOP(Number(data.iva))}</span></div>
          <div className="flex justify-between font-black text-base py-2 border-t-2 mt-1" style={{ borderColor: brand.brandColor, color: brand.brandColor }}>
            <span>TOTAL</span><span>{formatCOP(Number(data.total))}</span>
          </div>
          {data.saldoPendiente != null && data.saldoPendiente > 0 && (
            <div className="flex justify-between text-sm font-bold text-red-600"><span>Saldo pendiente</span><span>{formatCOP(Number(data.saldoPendiente))}</span></div>
          )}
        </div>
      </div>

      {data.cufe && (
        <div className="px-10 pb-4">
          <p className="text-[9px] text-gray-400">CUFE: {data.cufe}</p>
        </div>
      )}
      {data.notas && (
        <div className="px-10 pb-5">
          <div className="rounded-xl p-3 bg-gray-50 border-l-2" style={{ borderColor: brand.brandColor }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Notas</p>
            <p className="text-xs text-gray-600 whitespace-pre-wrap">{data.notas}</p>
          </div>
        </div>
      )}

      <div className="px-10 py-4 mt-2 text-center" style={{ backgroundColor: brand.brandColor + "0a" }}>
        <p className="text-xs font-semibold text-gray-700">{brand.companyName}</p>
        <p className="text-[10px] text-gray-500">{[brand.address, brand.phone, brand.email].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}
