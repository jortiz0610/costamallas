-- ============================================================
-- Entrar con huella (o Face ID, o el PIN del equipo).
--
-- Qué es y qué NO es:
--
--   SÍ es un segundo modo de ENTRAR en un dispositivo que ya pasó por
--   contraseña + doble factor. La huella no viaja a ningún lado: el
--   teléfono guarda la llave privada en su chip seguro y solo nos manda
--   una firma. Aquí no se almacena ninguna huella, ni se puede.
--
--   NO reemplaza el doble factor. Se registra DESPUÉS de haberlo pasado,
--   así que la regla se cumple igual: para tener huella en un teléfono,
--   antes hubo que autenticarse entero en ese teléfono.
--
-- Aditivo: tabla nueva, nada que migrar.
-- ============================================================

CREATE TABLE IF NOT EXISTS credenciales_webauthn (
  id            TEXT PRIMARY KEY,
  "usuarioId"   TEXT NOT NULL,
  -- El id de la credencial tal y como lo devuelve el navegador
  -- (base64url). Es único en el mundo, no solo aquí.
  "credentialId" TEXT NOT NULL UNIQUE,
  -- La llave PÚBLICA. La privada no sale nunca del dispositivo.
  "publicKey"   TEXT NOT NULL,
  -- Contador anti-clonación: si un dispositivo manda un número menor o
  -- igual al anterior, o alguien copió la credencial o algo va mal.
  contador      BIGINT NOT NULL DEFAULT 0,
  -- Para que la persona reconozca cuál borrar: "iPhone de Skarlyn".
  apodo         TEXT,
  transports    TEXT,
  "ultimoUsoEn" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT credenciales_webauthn_usuario_fkey
    FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "credenciales_webauthn_usuarioId_idx"
  ON credenciales_webauthn ("usuarioId");
