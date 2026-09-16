-- ============================================================
-- El identificador de la factura en SIIGO.
--
-- Marca las 1.985 facturas traídas del histórico (2020-2026) y hace la
-- importación repetible. Único pero nullable: una factura emitida desde
-- el portal no tiene equivalente en SIIGO.
-- ============================================================

ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "siigoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "facturas_siigoId_key"
  ON "facturas" ("siigoId");
