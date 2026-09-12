-- ============================================================
-- Borrar cotizaciones sin perder el rastro.
--
-- Las ofertas NO se borran de verdad: se marcan. Una cotización
-- desaparecida deja pedidos, seguimientos y cifras del embudo apuntando
-- al vacío, y a los tres meses nadie puede reconstruir qué pasó.
--
-- `numero` se libera al borrar —se cambia por un centinela— porque el
-- índice es ÚNICO: sin liberarlo, el consecutivo no podría volver a usar
-- ese número nunca. El que tenía se guarda en `numeroOriginal`, que es
-- justo lo que el administrador necesita ver en la lista de borradas.
-- ============================================================

ALTER TABLE "cotizaciones"
  ADD COLUMN IF NOT EXISTS "borradaEn"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "borradaPorId"   TEXT,
  ADD COLUMN IF NOT EXISTS "borradaMotivo"  TEXT,
  ADD COLUMN IF NOT EXISTS "numeroOriginal" TEXT;

-- Todas las pantallas filtran por "no borrada". Sin índice, cada listado
-- recorre la tabla entera.
CREATE INDEX IF NOT EXISTS "cotizaciones_borradaEn_idx"
  ON "cotizaciones" ("borradaEn");

-- Quién borró. Es la mitad de lo que hace útil la papelera: sin esto,
-- una oferta desaparecida no tiene responsable.
--
-- `SET NULL` al borrar el usuario: si alguien deja la empresa, su
-- nombre se va pero la oferta borrada TIENE que seguir existiendo.
ALTER TABLE "cotizaciones"
  ADD CONSTRAINT "cotizaciones_borradaPorId_fkey"
  FOREIGN KEY ("borradaPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
