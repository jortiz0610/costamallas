-- ============================================================
-- El identificador del cliente en SIIGO.
--
-- Es lo que permite repetir la importación sin duplicar: al volver a
-- correrla, cada cliente se reconoce por este campo aunque después
-- alguien le haya corregido el nombre, el teléfono o el NIT en el
-- portal.
--
-- Es UNICO pero admite nulo: los clientes que nacieron en el portal
-- —los que entran por el chat de la web o los crea un asesor— no tienen
-- equivalente en SIIGO y se quedan sin valor. En Postgres varios NULL
-- no chocan entre sí en un índice único, así que esto funciona.
-- ============================================================

ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "siigoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_siigoId_key"
  ON "clientes" ("siigoId");
