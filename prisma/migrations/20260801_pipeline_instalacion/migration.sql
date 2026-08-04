-- Pipeline con dias en etapa, e instalaciones con evidencia.
--
-- Aditivo: no borra ni modifica nada de lo que ya existe.

-- 1. Pedido: desde cuando esta en el estado actual --------------------
--
-- Sin esta columna, "dias en etapa" habria que sacarlo de updatedAt, que
-- cambia por cualquier edicion: un pedido estancado hace tres semanas
-- pareceria recien movido solo porque alguien le corrigio una nota.
ALTER TABLE "pedidos" ADD COLUMN IF NOT EXISTS "estadoDesde" TIMESTAMP(3);

-- Los pedidos que ya existen arrancan contando desde su ultima
-- actualizacion, que es la mejor aproximacion disponible.
UPDATE "pedidos" SET "estadoDesde" = "updatedAt" WHERE "estadoDesde" IS NULL;

-- 2. Instalacion: evidencia y checklist -------------------------------
--
-- Las fotos del antes y despues son el respaldo ante un reclamo de
-- garantia; el checklist evita cerrar una obra a medias.
ALTER TABLE "instalaciones" ADD COLUMN IF NOT EXISTS "fotos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "instalaciones" ADD COLUMN IF NOT EXISTS "checklist" JSONB NOT NULL DEFAULT '[]';
