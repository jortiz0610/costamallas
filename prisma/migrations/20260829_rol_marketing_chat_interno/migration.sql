-- ============================================================
-- 1. El rol MARKETING.
-- 2. El chat interno del equipo.
--
-- Sobre los roles retirados (BODEGA, USUARIO, SOLO_LECTURA): NO se
-- borran del enum. Quitar un valor de un enum de Postgres es DDL
-- destructivo y falla si alguien lo tiene puesto — y hay dos personas
-- activas en SOLO_LECTURA. Dejan de ofrecerse en el portal (eso vive en
-- `lib/permisos.ts`) y quien ya los tiene sigue viendo exactamente lo
-- mismo que veía. La decisión de a qué rol pasarlos es de gerencia:
-- PENDIENTES §17.
--
-- El chat interno es tablas propias y NO una conexión más de Nexus. Una
-- conversación de Nexus tiene remitente, canal, cliente y tiempo de
-- respuesta comprometido; un chat entre dos compañeros no tiene nada de
-- eso y meterlo ahí ensuciaría el informe de tiempos con conversaciones
-- que no son de ningún cliente.
--
-- Aditivo. Ninguna tabla ni columna existente se toca.
-- ============================================================

-- ── 1. Rol de marketing ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Rol' AND e.enumlabel = 'MARKETING'
  ) THEN
    ALTER TYPE "Rol" ADD VALUE 'MARKETING';
  END IF;
END $$;

-- ── 2. Chat interno ──

CREATE TABLE IF NOT EXISTS "chat_interno" (
  "id"        TEXT NOT NULL,
  -- DIRECTO (dos personas) o GRUPO.
  "tipo"      TEXT NOT NULL DEFAULT 'DIRECTO',
  -- Solo los grupos llevan nombre; un chat directo se nombra con la otra
  -- persona, que depende de quién lo esté mirando.
  "nombre"    TEXT,
  "creadoPorId" TEXT,
  -- Se sella con cada mensaje para poder ordenar la lista sin tener que
  -- mirar dentro de cada chat.
  "ultimoMensajeEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_interno_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_interno_ultimoMensajeEn_idx"
  ON "chat_interno" ("ultimoMensajeEn");

CREATE TABLE IF NOT EXISTS "chat_interno_miembros" (
  "id"        TEXT NOT NULL,
  "chatId"    TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  -- Hasta dónde leyó ESTA persona. Es lo que decide el contador de sin
  -- leer, y por eso va por miembro y no por chat.
  "ultimaLecturaEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_interno_miembros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_interno_miembros_chatId_usuarioId_key"
  ON "chat_interno_miembros" ("chatId", "usuarioId");
CREATE INDEX IF NOT EXISTS "chat_interno_miembros_usuarioId_idx"
  ON "chat_interno_miembros" ("usuarioId");

CREATE TABLE IF NOT EXISTS "chat_interno_mensajes" (
  "id"        TEXT NOT NULL,
  "chatId"    TEXT NOT NULL,
  "autorId"   TEXT NOT NULL,
  "contenido" TEXT NOT NULL,
  -- texto · imagen · archivo · audio
  "tipo"      TEXT NOT NULL DEFAULT 'texto',
  "adjuntoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_interno_mensajes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_interno_mensajes_chatId_createdAt_idx"
  ON "chat_interno_mensajes" ("chatId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_interno_miembros_chatId_fkey') THEN
    ALTER TABLE "chat_interno_miembros" ADD CONSTRAINT "chat_interno_miembros_chatId_fkey"
      FOREIGN KEY ("chatId") REFERENCES "chat_interno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_interno_miembros_usuarioId_fkey') THEN
    ALTER TABLE "chat_interno_miembros" ADD CONSTRAINT "chat_interno_miembros_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_interno_mensajes_chatId_fkey') THEN
    ALTER TABLE "chat_interno_mensajes" ADD CONSTRAINT "chat_interno_mensajes_chatId_fkey"
      FOREIGN KEY ("chatId") REFERENCES "chat_interno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_interno_mensajes_autorId_fkey') THEN
    ALTER TABLE "chat_interno_mensajes" ADD CONSTRAINT "chat_interno_mensajes_autorId_fkey"
      FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
