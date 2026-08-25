// ============================================================
// Lector mínimo de .xlsx, sin dependencias.
//
// Un .xlsx es un ZIP con XML dentro. Node trae `zlib`, que es lo único
// que hace falta para descomprimirlo, así que no se agrega una librería
// al proyecto para leer una hoja de cálculo cada tanto.
//
// Devuelve las celdas tal cual vienen (texto). Interpretar qué columna
// es qué es trabajo de quien llama: cada hoja de Costamallas tiene un
// layout distinto.
// ============================================================

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

/** Una hoja: filas indexadas por número, con sus celdas por letra de columna. */
export type Hoja = { fila: number; celdas: Record<string, string> }[];
export type Libro = Record<string, Hoja>;

// ── ZIP ──────────────────────────────────────────────────────

function leerZip(ruta: string): Map<string, Buffer> {
  const buf = readFileSync(ruta);

  // El "End of Central Directory" está al final; se busca hacia atrás
  // porque puede llevar un comentario de longitud variable detrás.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65_557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("No parece un .xlsx válido (falta el fin del ZIP).");

  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  const archivos = new Map<string, Buffer>();
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nombreLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + nombreLen);

    // La cabecera local repite los tamaños de nombre y extra, y pueden
    // NO coincidir con los del directorio central: hay que leerlos ahí.
    const lNombreLen = buf.readUInt16LE(offset + 26);
    const lExtraLen = buf.readUInt16LE(offset + 28);
    const inicio = offset + 30 + lNombreLen + lExtraLen;
    const crudo = buf.subarray(inicio, inicio + compSize);

    archivos.set(nombre, metodo === 0 ? crudo : inflateRawSync(crudo));
    p += 46 + nombreLen + extraLen + comentLen;
  }
  return archivos;
}

// ── XML ──────────────────────────────────────────────────────

function entidades(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&"); // al final, para no re-desescapar
}

export function leerLibro(ruta: string): Libro {
  const zip = leerZip(ruta);
  const texto = (n: string) => zip.get(n)?.toString("utf8") ?? "";

  // Cadenas compartidas: la mayoría del texto de un xlsx vive aquí.
  const compartidas: string[] = [];
  const ss = texto("xl/sharedStrings.xml");
  if (ss) {
    for (const bloque of ss.split("<si>").slice(1)) {
      const trozo = bloque.split("</si>")[0];
      const partes = [...trozo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
      compartidas.push(entidades(partes.join("")));
    }
  }

  const rels = texto("xl/_rels/workbook.xml.rels");
  const destino: Record<string, string> = {};
  for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) destino[m[1]] = m[2];

  const wb = texto("xl/workbook.xml");
  const libro: Libro = {};

  for (const m of wb.matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const nombre = entidades(m[1]);
    const rel = (destino[m[2]] ?? "").replace(/^\//, "").replace(/^xl\//, "");
    const xml = texto(`xl/${rel}`);
    if (!xml) continue;

    const filas: Record<number, Record<string, string>> = {};
    for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const [, col, filaTxt, attrs, cuerpo] = c;
      const tipo = (attrs.match(/t="([^"]+)"/) || [])[1];

      let valor: string;
      if (tipo === "s") {
        const i = Number((cuerpo.match(/<v>(\d+)<\/v>/) || [])[1]);
        valor = compartidas[i] ?? "";
      } else if (tipo === "inlineStr" || tipo === "str") {
        valor = entidades([...cuerpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(""));
      } else {
        valor = entidades((cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1] ?? "");
      }

      if (valor === "") continue;
      const f = Number(filaTxt);
      (filas[f] = filas[f] || {})[col] = valor.trim();
    }

    libro[nombre] = Object.keys(filas)
      .map(Number).sort((a, b) => a - b)
      .map(f => ({ fila: f, celdas: filas[f] }));
  }

  return libro;
}
