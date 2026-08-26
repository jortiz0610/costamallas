-- ============================================================
-- Aviso cuando se incumple el compromiso de responder en una hora.
--
-- /nexus/tiempos ya medía el compromiso, pero medirlo no avisa a nadie:
-- había que acordarse de abrir la pantalla. Faltaba el aviso.
--
-- Dos columnas, las dos aditivas:
--
--  1. `alertaTiempoEn` en la conversación: el sello de "a esta ya se
--     avisó". Sin él, la corrida diaria mandaría el mismo aviso todos
--     los días hasta que alguien conteste, y un aviso que se repite deja
--     de leerse a la tercera vez.
--
--  2. `usuarioId` en la notificación: hasta ahora todas eran globales y
--     las veía todo el mundo. El aviso de tiempo va dirigido al asesor
--     que tiene la conversación, y decirle a los siete usuarios que
--     Elkin no ha contestado no sirve de nada. NULL = global, que es lo
--     que ya son todas las existentes: nada cambia para ellas.
-- ============================================================

ALTER TABLE "nexus_conversaciones"
  ADD COLUMN IF NOT EXISTS "alertaTiempoEn" TIMESTAMP(3);

ALTER TABLE "notificaciones"
  ADD COLUMN IF NOT EXISTS "usuarioId" TEXT;

CREATE INDEX IF NOT EXISTS "notificaciones_usuarioId_idx" ON "notificaciones"("usuarioId");
