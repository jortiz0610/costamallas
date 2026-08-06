// ============================================================
// Las políticas, públicas y en una URL que se puede compartir.
//
// Estaban en dos .docx en el PC de alguien. Un cliente que quiere saber
// si puede devolver un rollo de malla no tenía dónde leerlo, y el asesor
// terminaba explicándolo de memoria, distinto cada vez.
//
// Es pública a propósito (no lleva datos de nadie) y se llega desde la
// cotización que recibe el cliente.
// ============================================================

import type { Metadata } from "next";
import { getMarca } from "@/lib/marca";
import { politicasResueltas } from "@/lib/postventa";

export const dynamic = "force-dynamic";

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";

export async function generateMetadata(): Promise<Metadata> {
  const marca = await getMarca();
  return {
    title: `Políticas · ${marca.companyName}`,
    description: "Políticas de envío, devoluciones y tratamiento de datos personales.",
  };
}

const SECCIONES = [
  { id: "envios", titulo: "Política de envíos y entrega" },
  { id: "devoluciones", titulo: "Política de devoluciones y reembolsos" },
  { id: "datos", titulo: "Política de tratamiento de la información" },
] as const;

/** El texto viene en párrafos separados por línea en blanco. */
function Texto({ contenido }: { contenido: string }) {
  return (
    <>
      {contenido.split(/\n{2,}/).map((p, i) => {
        // Los títulos numerados del documento original se resaltan; el
        // resto va como párrafo corrido.
        const esTitulo = /^\d+\.\s/.test(p.trim()) || (p.length < 60 && !p.includes("."));
        if (esTitulo) {
          return (
            <h3 key={i} style={{ margin: "28px 0 10px", fontSize: 15, fontWeight: 800, color: NEGRO, textTransform: "uppercase", letterSpacing: ".02em" }}>
              {p.trim()}
            </h3>
          );
        }
        return (
          <p key={i} style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.7, color: "#2b2d29" }}>
            {p.split("\n").map((linea, j) => (
              <span key={j}>{linea}{j < p.split("\n").length - 1 && <br />}</span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export default async function Politicas() {
  const [marca, pol] = await Promise.all([getMarca(), politicasResueltas()]);
  const contenidos: Record<string, string> = {
    envios: pol.envios,
    devoluciones: pol.devoluciones,
    datos: pol.datos,
  };

  return (
    <div style={{ backgroundColor: "#e9ecef", minHeight: "100vh" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", backgroundColor: "#fff" }}>
        {/* Cabecera con el lenguaje visual de costamallas.com */}
        <div style={{ backgroundColor: NEGRO, padding: "34px 32px" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: AMARILLO }}>
            {marca.companyName}
          </p>
          <h1 style={{ margin: "10px 0 0", fontSize: 34, lineHeight: 1, color: "#fff", textTransform: "uppercase", fontWeight: 900 }}>
            Políticas
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "rgba(255,255,255,.6)", maxWidth: 520, lineHeight: 1.6 }}>
            Envíos y entrega, devoluciones y reembolsos, y tratamiento de sus datos personales.
          </p>
        </div>
        <div style={{ height: 5, backgroundColor: AMARILLO }} />

        {/* Índice */}
        <nav style={{ padding: "20px 32px", borderBottom: "1px solid #e5e5e0", display: "flex", flexWrap: "wrap", gap: 16 }}>
          {SECCIONES.map(s => (
            <a key={s.id} href={`#${s.id}`}
              style={{ fontSize: 12, fontWeight: 700, color: NEGRO, textDecoration: "none", borderBottom: `2px solid ${AMARILLO}`, paddingBottom: 2 }}>
              {s.titulo}
            </a>
          ))}
        </nav>

        <div style={{ padding: "8px 32px 40px" }}>
          {SECCIONES.map(s => (
            <section key={s.id} id={s.id} style={{ paddingTop: 32, scrollMarginTop: 20 }}>
              <div style={{ display: "inline-block", backgroundColor: NEGRO, color: AMARILLO, padding: "6px 12px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 16 }}>
                {s.titulo}
              </div>
              <Texto contenido={contenidos[s.id]} />
            </section>
          ))}
        </div>

        <div style={{ padding: "18px 32px", backgroundColor: NEGRO, color: "rgba(255,255,255,.5)", fontSize: 11, lineHeight: 1.6 }}>
          {marca.legalName ?? marca.companyName}
          {marca.nit ? ` · NIT ${marca.nit}` : ""}
          {marca.address ? ` · ${marca.address}` : ""}
          {marca.phone ? ` · ${marca.phone}` : ""}
          {marca.email ? ` · ${marca.email}` : ""}
        </div>
      </div>
    </div>
  );
}
