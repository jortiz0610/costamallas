-- ============================================================
-- El identificador del documento en SIIGO.
--
-- Marca las cotizaciones TRAÍDAS del histórico (6.323, desde enero de
-- 2021) y separa lo importado de lo que nace en el portal.
--
-- Único pero nullable: las cotizaciones que crea un asesor aquí no
-- tienen equivalente en SIIGO. En Postgres varios NULL no chocan en un
-- índice único.
--
-- El índice por estado es para la pantalla: sin él, filtrar el embudo
-- pasaría a recorrer 6.400 filas en vez de 65.
-- ============================================================

ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "siigoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "cotizaciones_siigoId_key"
  ON "cotizaciones" ("siigoId");

CREATE INDEX IF NOT EXISTS "cotizaciones_estado_idx"
  ON "cotizaciones" ("estado");
