-- ============================================================
-- Avisos con el portal CERRADO.
--
-- Hasta ahora las notificaciones solo se veían con la pestaña abierta o
-- en segundo plano. Eso deja fuera justo el caso que importa: el asesor
-- que está en la calle y al que acaban de aprobarle una oferta.
--
-- Una fila por NAVEGADOR y no por persona: la misma usuaria tiene el
-- teléfono y el computador de la oficina, y quiere el aviso en los dos.
-- El `endpoint` es único porque ES la identidad del aparato — si el
-- navegador vuelve a suscribirse con el mismo, se actualiza en vez de
-- duplicarse.
-- ============================================================

CREATE TABLE IF NOT EXISTS "suscripciones_push" (
  "id"          TEXT NOT NULL,
  "usuarioId"   TEXT NOT NULL,
  "endpoint"    TEXT NOT NULL,
  "p256dh"      TEXT NOT NULL,
  "auth"        TEXT NOT NULL,
  "agente"      TEXT,
  "fallos"      INTEGER NOT NULL DEFAULT 0,
  "ultimoUsoEn" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "suscripciones_push_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suscripciones_push_endpoint_key"
  ON "suscripciones_push" ("endpoint");

CREATE INDEX IF NOT EXISTS "suscripciones_push_usuarioId_idx"
  ON "suscripciones_push" ("usuarioId");

-- Al borrar una persona se van sus suscripciones: sin cuenta no hay a
-- quién avisarle, y un endpoint huérfano seguiría recibiendo avisos.
ALTER TABLE "suscripciones_push"
  ADD CONSTRAINT "suscripciones_push_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
