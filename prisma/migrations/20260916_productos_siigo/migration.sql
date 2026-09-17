-- ============================================================
-- El catálogo de SIIGO en sala de espera.
--
-- 1.044 productos que NO se meten al catálogo sin mirarlos: solo el 29%
-- tiene precio, y una ficha sin precio no se puede publicar ni cotizar.
-- Aquí esperan a que un administrador decida traer o descartar.
-- ============================================================

CREATE TABLE IF NOT EXISTS "productos_siigo" (
  "id"            TEXT NOT NULL,
  "siigoId"       TEXT NOT NULL,
  "codigo"        TEXT NOT NULL,
  "nombre"        TEXT NOT NULL,
  "descripcion"   TEXT,
  "precio"        DECIMAL(14,2),
  "ivaPct"        DECIMAL(5,2),
  "unidad"        TEXT,
  "tipo"          TEXT NOT NULL DEFAULT 'Product',
  "activoEnSiigo" BOOLEAN NOT NULL DEFAULT true,
  "existencias"   DECIMAL(10,2) NOT NULL DEFAULT 0,
  "grupo"         TEXT,
  "decision"      TEXT NOT NULL DEFAULT 'PENDIENTE',
  "decididoPorId" TEXT,
  "decididoEn"    TIMESTAMP(3),
  "productoId"    TEXT,
  "errorAlTraer"  TEXT,
  "yaEnPortal"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "productos_siigo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "productos_siigo_siigoId_key" ON "productos_siigo" ("siigoId");
CREATE INDEX IF NOT EXISTS "productos_siigo_decision_idx"   ON "productos_siigo" ("decision");
CREATE INDEX IF NOT EXISTS "productos_siigo_yaEnPortal_idx" ON "productos_siigo" ("yaEnPortal");
