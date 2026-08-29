-- ============================================================
-- Fase 4 de la cotización, en una sola migración aditiva:
--
--   1. Cotizaciones de PRUEBA (`esPrueba`) — y la marca se hereda al
--      pedido, para que un pedido nacido de una prueba no ensucie el
--      pipeline ni la plata del embudo.
--   2. Visita técnica previa (`requiereVisita` + tabla `visitas_tecnicas`).
--   3. SG-SST (`requiereSgsst` + tabla `sgsst_personas`).
--   4. Aplazar el vencimiento de una oferta (`prorrogaDias`, `prorrogas`).
--   5. Productos que no admiten descuento individual (`sinDescuento`).
--
-- Todo aditivo. Ninguna columna existente se toca y ninguna fila se
-- borra: sin datos nuevos, el portal se comporta igual que antes.
-- ============================================================

-- ── 1. Cotizaciones de prueba ──────────────────────────────
-- Solo el superadministrador las crea. Quedan FUERA de informes,
-- embudo, pipeline y del consecutivo real: llevan numeración aparte
-- (PRUEBA-001) para no quemar números de COT.
ALTER TABLE "cotizaciones"
  ADD COLUMN IF NOT EXISTS "esPrueba" BOOLEAN NOT NULL DEFAULT false,
  -- ── 2. Visita técnica previa ──
  -- El vendedor marca que hace falta ir a medir antes de cotizar en
  -- firme. Al coordinador de producción le llega la solicitud.
  ADD COLUMN IF NOT EXISTS "requiereVisita" BOOLEAN NOT NULL DEFAULT false,
  -- ── 3. SG-SST ──
  -- Habilita al coordinador la carga de documentos por trabajador.
  ADD COLUMN IF NOT EXISTS "requiereSgsst" BOOLEAN NOT NULL DEFAULT false,
  -- ── 4. Aplazar el vencimiento ──
  -- El vencimiento sale de createdAt + validezDias. La prórroga se
  -- guarda APARTE y no sumada a validezDias, para que el documento siga
  -- diciendo la validez que se le ofreció al cliente y quede claro
  -- cuánto se estiró después.
  ADD COLUMN IF NOT EXISTS "prorrogaDias" INTEGER NOT NULL DEFAULT 0,
  -- Cuántas veces se aplazó. El tope del vendedor es 2; un
  -- administrador no tiene tope.
  ADD COLUMN IF NOT EXISTS "prorrogas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prorrogadaEn" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prorrogadaPorId" TEXT;

CREATE INDEX IF NOT EXISTS "cotizaciones_esPrueba_idx" ON "cotizaciones" ("esPrueba");

-- La marca se hereda: un pedido nacido de una cotización de prueba es
-- una prueba, y tiene que poder excluirse de los mismos sitios.
ALTER TABLE "pedidos"
  ADD COLUMN IF NOT EXISTS "esPrueba" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "pedidos_esPrueba_idx" ON "pedidos" ("esPrueba");

-- ── 5. Productos sin descuento ─────────────────────────────
-- No admiten descuento por línea (margen mínimo), pero SÍ entran en el
-- descuento global de la oferta: el global es una decisión sobre el
-- negocio completo, no sobre este producto.
ALTER TABLE "productos"
  ADD COLUMN IF NOT EXISTS "sinDescuento" BOOLEAN NOT NULL DEFAULT false;

-- ── Visitas técnicas ───────────────────────────────────────
-- Base: el formato "F. Visita tecnica.xlsx" de la empresa. Los datos
-- del formulario van en JSON y no en 30 columnas porque el formato
-- cambia —tiene dos bloques muy distintos, cerca eléctrica y malla
-- invisible— y una columna por casilla obligaría a migrar la base cada
-- vez que producción añada una medida.
CREATE TABLE IF NOT EXISTS "visitas_tecnicas" (
  "id"            TEXT NOT NULL,
  "cotizacionId"  TEXT NOT NULL,
  -- SOLICITADA · AGENDADA · REALIZADA · CANCELADA
  "estado"        TEXT NOT NULL DEFAULT 'SOLICITADA',
  -- Quién la pidió (el vendedor) y quién la atiende (producción).
  "solicitadaPorId" TEXT,
  "coordinadorId"   TEXT,
  "fechaAgendada"   TIMESTAMP(3),
  "fechaRealizada"  TIMESTAMP(3),
  "direccion"     TEXT,
  "ciudad"        TEXT,
  "contacto"      TEXT,
  "telefono"      TEXT,
  -- El formulario lleno: cerca eléctrica (altura y material del muro,
  -- metros lineales, postes, aisladores, alambre, tapones, placas,
  -- cable, tubos EMT, acabado, punto eléctrico, distancias) y malla
  -- invisible (medidas de balcón y ventanas, vidrio, material superior).
  "datos"         JSONB NOT NULL DEFAULT '{}',
  -- [{ url, titulo, momento }]
  "fotos"         JSONB NOT NULL DEFAULT '[]',
  -- El FORMATO REQUISICION DE MATERIALES Y HERRAMIENTAS que producción
  -- entrega al volver: { proyecto, ubicacion, responsable, descripcion,
  -- tiempoEjecucion, materiales:[], herramientas:[], especiales }
  "requisicion"   JSONB NOT NULL DEFAULT '{}',
  "observaciones" TEXT,
  -- Sello de la devolución al vendedor: cuándo producción entregó la
  -- visita y la oportunidad volvió a "pendiente cotización".
  "devueltaEn"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "visitas_tecnicas_pkey" PRIMARY KEY ("id")
);

-- Una visita por cotización: si hay que volver, se reabre la misma, no
-- se crea otra. Dos visitas de la misma oferta dejarían al coordinador
-- sin saber cuál es la buena.
CREATE UNIQUE INDEX IF NOT EXISTS "visitas_tecnicas_cotizacionId_key"
  ON "visitas_tecnicas" ("cotizacionId");
CREATE INDEX IF NOT EXISTS "visitas_tecnicas_estado_idx"
  ON "visitas_tecnicas" ("estado");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitas_tecnicas_cotizacionId_fkey') THEN
    ALTER TABLE "visitas_tecnicas"
      ADD CONSTRAINT "visitas_tecnicas_cotizacionId_fkey"
      FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── SG-SST: una fila por PERSONA ───────────────────────────
-- La carga es por persona de una vez —cédula, planilla, alturas— y no
-- un documento suelto cada vez, porque así es como llegan: el
-- contratista manda la carpeta de un trabajador completa.
CREATE TABLE IF NOT EXISTS "sgsst_personas" (
  "id"           TEXT NOT NULL,
  "cotizacionId" TEXT NOT NULL,
  "nombre"       TEXT NOT NULL,
  "cedula"       TEXT,
  -- TRABAJADOR · COORD_SST · COORD_ALTURAS
  "rol"          TEXT NOT NULL DEFAULT 'TRABAJADOR',
  -- Qué documentos aplican a esta persona. Son casillas OPCIONALES: no
  -- todo trabajador necesita certificado de alturas.
  -- { cedula: true, planilla: true, alturas: false, ... }
  "requeridos"   JSONB NOT NULL DEFAULT '{}',
  -- Lo cargado: [{ tipo, nombreArchivo, tamano, subidoEn, subidoPorId,
  --                almacenado: false, motivo }]
  --
  -- ⚠️ `almacenado` es false a propósito mientras no haya dónde
  -- guardarlos. Son datos personales: no van al FTP (roto) ni a la
  -- biblioteca pública de WordPress. Hasta la migración al VPS se
  -- registra QUÉ documento se entregó y cuándo, y la pantalla dice con
  -- todas las letras que el archivo todavía no se guarda.
  "documentos"   JSONB NOT NULL DEFAULT '[]',
  "observaciones" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sgsst_personas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sgsst_personas_cotizacionId_idx"
  ON "sgsst_personas" ("cotizacionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sgsst_personas_cotizacionId_fkey') THEN
    ALTER TABLE "sgsst_personas"
      ADD CONSTRAINT "sgsst_personas_cotizacionId_fkey"
      FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── El tope de descuento sube al 10 % ──────────────────────
-- Decisión de gerencia: el vendedor tiene un tope LIBRE del 10 %, no una
-- lista de valores fijos — puede poner 3, 6,5 u 8. Pasarse cae en la
-- política comercial, que ya exige visto bueno de un administrador.
INSERT INTO "configuracion" ("id", "clave", "valor", "descripcion", "updatedAt")
VALUES (
  'cfg_com_descuento_max_pct',
  'com_descuento_max_pct',
  '10',
  'Politica comercial: descuento maximo sin aprobacion',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("clave") DO UPDATE SET "valor" = '10', "updatedAt" = CURRENT_TIMESTAMP;
