-- ============================================================
-- Permisos por SUBMÓDULO y por USUARIO.
--
-- Hasta hoy el permiso era solo por módulo y vivía en código
-- (`MODULOS_POR_ROL` en lib/permisos.ts): `VENDEDOR: ["CRM","NEXUS"]`.
-- Eso obliga a desplegar para darle a una persona una pantalla, y no
-- permite matices: un vendedor necesita ver el stock del ERP pero no la
-- cartera, y necesita abrir la ficha de un producto sin poder editarla.
--
-- Cómo queda:
--   · El ROL sigue trayendo un juego por defecto, que vive en código
--     (`PERMISOS_POR_ROL`). Es lo que aplica mientras nadie toque nada,
--     y es lo que se usa en "ver el portal como…", donde los ajustes
--     personales de otro usuario no pintan nada.
--   · Esta tabla guarda SOLO las EXCEPCIONES de cada persona: una fila
--     por permiso que se le activó o se le quitó a mano. Guardar el
--     juego completo por usuario sería peor: el día que el rol gane una
--     pantalla nueva, nadie la vería.
--
-- `permitido` es booleano a propósito y no un "tiene la fila = lo
-- tiene": hay que poder QUITAR algo que el rol sí trae.
--
-- Aditivo: ninguna tabla existente se toca. Sin filas, el portal se
-- comporta exactamente igual que antes de esta migración.
-- ============================================================

CREATE TABLE IF NOT EXISTS "permisos_usuario" (
  "id"        TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  -- Clave del submódulo o de la acción, p.ej. "erp.stock" o
  -- "erp.productos.editar". El catálogo vive en lib/permisos.ts.
  "clave"     TEXT NOT NULL,
  -- true = concedido aunque el rol no lo traiga.
  -- false = retirado aunque el rol sí lo traiga.
  "permitido" BOOLEAN NOT NULL,
  -- Quién lo cambió y por qué. Un permiso suelto que nadie recuerda
  -- haber dado es la forma más común de que se quede puesto para siempre.
  "otorgadoPorId" TEXT,
  "nota"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "permisos_usuario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permisos_usuario_usuarioId_clave_key"
  ON "permisos_usuario" ("usuarioId", "clave");

CREATE INDEX IF NOT EXISTS "permisos_usuario_usuarioId_idx"
  ON "permisos_usuario" ("usuarioId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permisos_usuario_usuarioId_fkey'
  ) THEN
    ALTER TABLE "permisos_usuario"
      ADD CONSTRAINT "permisos_usuario_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
