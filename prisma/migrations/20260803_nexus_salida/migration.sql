-- Nexus: que las respuestas salgan de verdad.
--
-- Hasta ahora "responder" solo escribia una fila en nexus_mensajes. El
-- cliente nunca recibia nada y nadie se enteraba, porque no habia donde
-- registrar que el envio no ocurrio.
--
-- Aditivo: no borra ni modifica nada existente.

-- 1. Mensajes: resultado del envio ------------------------------------
--
-- PENDIENTE es el valor de arranque para los mensajes del agente; los que
-- entran del contacto se marcan RECIBIDO. Sin este campo, un fallo de la
-- API de WhatsApp era invisible.
ALTER TABLE "nexus_mensajes" ADD COLUMN IF NOT EXISTS "estadoEnvio" TEXT NOT NULL DEFAULT 'RECIBIDO';
ALTER TABLE "nexus_mensajes" ADD COLUMN IF NOT EXISTS "errorEnvio" TEXT;
-- Id del mensaje en el canal (wamid de WhatsApp), para conciliar despues.
ALTER TABLE "nexus_mensajes" ADD COLUMN IF NOT EXISTS "refExterna" TEXT;

-- 2. Conversaciones ---------------------------------------------------

-- Lo que el bot saca del primer mensaje: producto, ciudad, urgencia.
ALTER TABLE "nexus_conversaciones" ADD COLUMN IF NOT EXISTS "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Vinculo con el CRM. Una conversacion suelta no sirve de nada: lo que
-- vale es saber que este que escribe ya es cliente y que compro antes.
ALTER TABLE "nexus_conversaciones" ADD COLUMN IF NOT EXISTS "clienteId" TEXT;

-- Cuando contesto un humano por primera vez. Es lo que permite medir el
-- compromiso de responder en una hora que fijo la gerencia.
ALTER TABLE "nexus_conversaciones" ADD COLUMN IF NOT EXISTS "primeraRespuestaEn" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nexus_conversaciones_clienteId_fkey') THEN
    ALTER TABLE "nexus_conversaciones"
      ADD CONSTRAINT "nexus_conversaciones_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "nexus_conversaciones_clienteId_idx" ON "nexus_conversaciones"("clienteId");
