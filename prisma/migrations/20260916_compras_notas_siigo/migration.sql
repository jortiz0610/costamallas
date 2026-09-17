-- ============================================================
-- Compras a proveedores y notas crédito, traídas de SIIGO.
--
-- `/v1/purchases` de SIIGO son las compras que hace COSTAMALLAS a sus
-- proveedores, no lo que compran los clientes. Por eso van contra
-- Proveedor y OrdenCompra, que es donde corresponden.
--
-- Las notas crédito sí son de clientes: anulan o rebajan una factura ya
-- emitida. Sin ellas la cartera sale inflada.
-- ============================================================

ALTER TABLE "proveedores"    ADD COLUMN IF NOT EXISTS "siigoId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN IF NOT EXISTS "siigoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "proveedores_siigoId_key"    ON "proveedores" ("siigoId");
CREATE UNIQUE INDEX IF NOT EXISTS "ordenes_compra_siigoId_key" ON "ordenes_compra" ("siigoId");

CREATE TABLE IF NOT EXISTS "notas_credito" (
  "id"         TEXT NOT NULL,
  "numero"     TEXT NOT NULL,
  "siigoId"    TEXT,
  "clienteId"  TEXT NOT NULL,
  "facturaId"  TEXT,
  "fecha"      TIMESTAMP(3) NOT NULL,
  "motivo"     TEXT,
  "total"      DECIMAL(14,2) NOT NULL DEFAULT 0,
  "estadoDian" TEXT NOT NULL DEFAULT 'NO_APLICA',
  "cufe"       TEXT,
  "notas"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notas_credito_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notas_credito_numero_key"  ON "notas_credito" ("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "notas_credito_siigoId_key" ON "notas_credito" ("siigoId");
CREATE INDEX IF NOT EXISTS "notas_credito_clienteId_idx"      ON "notas_credito" ("clienteId");
CREATE INDEX IF NOT EXISTS "notas_credito_facturaId_idx"      ON "notas_credito" ("facturaId");

-- `Restrict` en el cliente: una nota crédito es un documento contable y
-- no puede quedar huérfana porque alguien borró una ficha del CRM.
ALTER TABLE "notas_credito"
  ADD CONSTRAINT "notas_credito_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- `SET NULL` en la factura: si la factura no se pudo enlazar o se borra,
-- la nota sigue existiendo — lo que corrige es un hecho contable.
ALTER TABLE "notas_credito"
  ADD CONSTRAINT "notas_credito_facturaId_fkey"
  FOREIGN KEY ("facturaId") REFERENCES "facturas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
