-- ============================================================
-- Cola de revisión del SEO generado por IA.
--
-- 175 de 176 productos no tienen SEO. El generador existía desde la
-- Fase 2 pero iba de a UNO y ni siquiera guardaba: devolvía el texto
-- para que una persona lo pegara. Hacerlos todos era abrir 175 fichas.
--
-- ⚠️ Por qué una COLA y no escritura directa: guardar un producto
-- dispara la sincronización con WooCommerce, así que lo que se escriba
-- aquí sale publicado en costamallas.com. Texto de IA sin leer, en la
-- tienda, a nombre de la empresa. La propuesta se genera en lote, queda
-- en PROPUESTO, y alguien aprueba o rechaza producto por producto.
--
-- Aditivo e idempotente. No toca `productos`.
-- ============================================================

CREATE TABLE IF NOT EXISTS "seo_propuestas" (
  "id"             TEXT NOT NULL,
  "productoId"     TEXT NOT NULL,
  -- PROPUESTO · APROBADO · RECHAZADO · ERROR
  "estado"         TEXT NOT NULL DEFAULT 'PROPUESTO',
  -- Agrupa las propuestas de una misma corrida, para poder ver "el lote
  -- de anoche" y saber cuánto costó.
  "loteId"         TEXT,

  "seoTitulo"      TEXT NOT NULL DEFAULT '',
  "seoDescripcion" TEXT NOT NULL DEFAULT '',
  "seoKeywords"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "seoTexto"       TEXT NOT NULL DEFAULT '',
  "slug"           TEXT NOT NULL DEFAULT '',
  -- [{ id, altText, titulo }] por imagen del producto.
  "imagenes"       JSONB NOT NULL DEFAULT '[]',

  -- ⚠️ Cambiar el slug de un producto YA publicado rompe la URL que
  -- Google tiene indexada y los enlaces que haya por ahí. Por eso el
  -- slug propuesto NO se aplica salvo que alguien lo marque a mano.
  "aplicaSlug"     BOOLEAN NOT NULL DEFAULT false,

  "modelo"         TEXT,
  "tokensEntrada"  INTEGER NOT NULL DEFAULT 0,
  "tokensSalida"   INTEGER NOT NULL DEFAULT 0,
  "costoUSD"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "error"          TEXT,

  "generadoPor"    TEXT,
  "revisadoPor"    TEXT,
  "revisadoEn"     TIMESTAMP(3),

  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "seo_propuestas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_propuestas_estado_idx"     ON "seo_propuestas"("estado");
CREATE INDEX IF NOT EXISTS "seo_propuestas_productoId_idx" ON "seo_propuestas"("productoId");
CREATE INDEX IF NOT EXISTS "seo_propuestas_loteId_idx"     ON "seo_propuestas"("loteId");

-- Si se borra el producto, su propuesta no tiene a quién aplicarse.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_propuestas_productoId_fkey'
  ) THEN
    ALTER TABLE "seo_propuestas"
      ADD CONSTRAINT "seo_propuestas_productoId_fkey"
      FOREIGN KEY ("productoId") REFERENCES "productos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
