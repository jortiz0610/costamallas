-- ============================================================
-- La VISITA TÉCNICA, antes de que exista la cotización.
--
-- El proceso real de Costamallas empieza a veces por una visita: alguien
-- va, mide, ve el sitio y llena un formato; con eso el vendedor cotiza.
-- Hasta hoy el portal no tenía dónde poner eso, porque una `instalacion`
-- exigía un `pedidoId` — y en una visita todavía no hay pedido.
--
-- Se extiende `instalaciones` en vez de crear una tabla nueva: para el
-- de producción una visita y una instalación son lo mismo —ir a una
-- dirección, hacer algo, anotarlo y que le firmen—, y separarlas le
-- habría dado dos listas donde necesita una.
--
-- Aditivo. Lo único que cambia de lo existente es que `pedidoId` deja de
-- ser obligatorio: en Postgres un UNIQUE admite varios NULL, así que la
-- restricción sigue valiendo para los pedidos de verdad.
-- ============================================================

-- Una visita no nace de un pedido.
ALTER TABLE instalaciones ALTER COLUMN "pedidoId" DROP NOT NULL;

-- VISITA · INSTALACION
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'INSTALACION';

-- De quién es la visita, cuando no hay pedido de por medio.
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "clienteId" TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "vendedorId" TEXT;
-- La cotización que nació de la visita. Cierra el círculo: desde la
-- oferta se puede ver qué se midió, y desde la visita si ya se cotizó.
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "cotizacionId" TEXT;

-- ── El formato que llena producción en campo ──
-- Medidas y observaciones van en texto libre a propósito: cada obra es
-- distinta y un formulario rígido obliga a escribir "otro" en la mitad
-- de los campos.
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "medidas" TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "condicionesSitio" TEXT;
-- [{ nombre, cantidad, unidad, nota }] — lo que el de producción
-- recomienda. SIN precios: en campo no se negocia.
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "recomendados" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── La firma del cliente ──
-- El trazo, como PNG en base64. Va en la fila y no en un archivo porque
-- son unos pocos KB y porque el disco privado todavía no existe: una
-- firma en una URL adivinable es exactamente lo que no se puede hacer.
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "firmaImagen" TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "firmaNombre" TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "firmaDocumento" TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "firmadoEn" TIMESTAMP(3);

-- Sello del correo que se manda al terminar. Uno por trabajo.
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "avisoCierreEn" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "instalaciones_tipo_idx"      ON instalaciones ("tipo");
CREATE INDEX IF NOT EXISTS "instalaciones_clienteId_idx" ON instalaciones ("clienteId");
CREATE INDEX IF NOT EXISTS "instalaciones_fechaAgendada_idx" ON instalaciones ("fechaAgendada");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instalaciones_clienteId_fkey') THEN
    ALTER TABLE instalaciones
      ADD CONSTRAINT "instalaciones_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES clientes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instalaciones_cotizacionId_fkey') THEN
    ALTER TABLE instalaciones
      ADD CONSTRAINT "instalaciones_cotizacionId_fkey"
      FOREIGN KEY ("cotizacionId") REFERENCES cotizaciones(id) ON DELETE SET NULL;
  END IF;
END $$;
