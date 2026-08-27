-- ============================================================
-- Agente de atención al cliente para costamallas.com
--
-- El agente atiende en la web pública y cada conversación entra a la
-- bandeja de Nexus como canal WEB, para que un asesor la vea, la
-- conteste y quede medida por el compromiso de respuesta.
--
-- `tokenWeb`: el secreto con el que el navegador del cliente retoma SU
-- conversación. No se puede usar el id: los ids son adivinables de a
-- poco y con uno cualquiera se leería la conversación de otra persona.
-- Va indexado y único porque cada mensaje del widget lo busca.
--
-- `costoUSD`: lo que lleva gastado esa conversación. Es lo que permite
-- cortar una charla que se fue de precio sin tener que sumar los
-- registros de toda la tabla en cada mensaje.
--
-- Aditivo. No toca nada de lo que ya existe.
-- ============================================================

ALTER TABLE "nexus_conversaciones"
  ADD COLUMN IF NOT EXISTS "tokenWeb" TEXT;

ALTER TABLE "nexus_conversaciones"
  ADD COLUMN IF NOT EXISTS "costoUSD" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "nexus_conversaciones_tokenWeb_key"
  ON "nexus_conversaciones"("tokenWeb");
