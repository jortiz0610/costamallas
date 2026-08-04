-- Seguimiento post-cotizacion, tope de descuento/anticipo y acta de entrega.
--
-- Aditivo: solo agrega columnas y una tabla. No borra ni modifica nada
-- de lo que ya existe. Idempotente: se puede correr dos veces.

-- 1. Seguimiento post-cotizacion --------------------------------------
--
-- La gerencia quiere subir la tasa de cierre del 10% al 28%. El sistema
-- ya sabia cuando se envio la oferta y cuando la abrio el cliente, pero
-- despues de eso no pasaba nada: el seguimiento dependia de que el
-- asesor se acordara. Esta tabla es la memoria de esos tres toques.

ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "seguimientoActivo" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "seguimientos_cotizacion" (
  "id"              TEXT PRIMARY KEY,
  "cotizacionId"    TEXT NOT NULL,
  -- 1 = confirmar recibido (automatico) · 2 = llamada del asesor
  -- (persona) · 3 = cierre por vencimiento (automatico).
  "toque"           INTEGER NOT NULL,
  "canal"           TEXT NOT NULL DEFAULT 'EMAIL',
  -- PENDIENTE · ENVIADO · HECHO · ERROR · OMITIDO
  "estado"          TEXT NOT NULL DEFAULT 'PENDIENTE',
  "programadoPara"  TIMESTAMP(3) NOT NULL,
  "ejecutadoEn"     TIMESTAMP(3),
  "destino"         TEXT,
  -- El texto que se envio (o que se enviara). Queda guardado para poder
  -- explicar despues que fue exactamente lo que recibio el cliente.
  "mensaje"         TEXT,
  "error"           TEXT,
  -- Toque 2: la tarea que se le creo al asesor, y cuando se le aviso a
  -- gerencia que no la habia atendido.
  "tareaId"         TEXT,
  "alertaEnviadaEn" TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seguimientos_cotizacion_cotizacionId_fkey"
    FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Un solo registro por toque y cotizacion: es el seguro contra que el
-- cron duplique el correo si se ejecuta dos veces el mismo dia.
CREATE UNIQUE INDEX IF NOT EXISTS "seguimientos_cotizacion_cotizacionId_toque_key"
  ON "seguimientos_cotizacion"("cotizacionId", "toque");
CREATE INDEX IF NOT EXISTS "seguimientos_cotizacion_estado_idx"
  ON "seguimientos_cotizacion"("estado");
CREATE INDEX IF NOT EXISTS "seguimientos_cotizacion_programadoPara_idx"
  ON "seguimientos_cotizacion"("programadoPara");

-- 2. Tope de descuento y anticipo -------------------------------------
--
-- El descuento se guardaba solo como monto, asi que no habia contra que
-- comparar un tope en porcentaje. `descuentoPct` guarda lo que el asesor
-- realmente concedio sobre el subtotal.

ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "descuentoPct" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "anticipoPct" DECIMAL(5,2);
-- NO_REQUIERE · PENDIENTE · APROBADA · RECHAZADA
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "aprobacionEstado" TEXT NOT NULL DEFAULT 'NO_REQUIERE';
-- Por que quedo pidiendo visto bueno (descuento, anticipo o ambos).
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "aprobacionMotivo" TEXT;
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "aprobadaPorId" TEXT;
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "aprobadaPorNombre" TEXT;
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "aprobadaEn" TIMESTAMP(3);
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "aprobacionNota" TEXT;

CREATE INDEX IF NOT EXISTS "cotizaciones_aprobacionEstado_idx"
  ON "cotizaciones"("aprobacionEstado");

-- Las cotizaciones que ya existen se dejan con el porcentaje que se
-- puede deducir de lo guardado. Sin esto, una oferta vieja con 20% de
-- descuento apareceria como si no tuviera ninguno.
UPDATE "cotizaciones"
   SET "descuentoPct" = ROUND(("descuento" / NULLIF("subtotal", 0)) * 100, 2)
 WHERE "descuentoPct" = 0 AND "descuento" > 0 AND "subtotal" > 0;

-- 3. Instalacion: acta de entrega y aviso al coordinador ---------------

ALTER TABLE "instalaciones" ADD COLUMN IF NOT EXISTS "actaFirmadaEn" TIMESTAMP(3);
-- Quien recibio la obra en sitio: no siempre es el cliente que compro.
ALTER TABLE "instalaciones" ADD COLUMN IF NOT EXISTS "actaRecibidoPor" TEXT;
ALTER TABLE "instalaciones" ADD COLUMN IF NOT EXISTS "actaDocumento" TEXT;
ALTER TABLE "instalaciones" ADD COLUMN IF NOT EXISTS "actaObservaciones" TEXT;
-- Sello del aviso al coordinador de proyectos. Es lo que evita que se
-- le avise dos veces por el mismo pedido.
ALTER TABLE "instalaciones" ADD COLUMN IF NOT EXISTS "avisoCoordinadorEn" TIMESTAMP(3);
