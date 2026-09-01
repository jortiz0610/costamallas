-- ============================================================
-- La encuesta de satisfacción.
--
-- El formato en papel de la empresa —"Formato Valoración de cliente"—
-- pide: NPS (0-10, «¿con qué probabilidad nos recomendaría?»), qué
-- destacaría, seis puntajes de 0 a 10 (calidad, relación calidad-precio,
-- profesionalidad, atención, puntualidad y limpieza), probabilidad de
-- recompra y recomendaciones abiertas.
--
-- Existía la plantilla del correo y el texto de configuración, pero
-- NADA que recogiera la respuesta: el botón no tenía a dónde llevar.
--
-- Tabla propia y no un JSON en `configuracion` porque esto se va a
-- promediar, filtrar por asesor y mirar por mes. Un JSON que hay que
-- parsear entero para sacar un promedio deja de servir a las cien
-- respuestas.
--
-- El TOKEN es lo que hace que el enlace del correo funcione sin cuenta:
-- largo y aleatorio, distinto del id, para que nadie conteste por otro
-- cambiando un número.
--
-- Aditivo.
-- ============================================================

CREATE TABLE IF NOT EXISTS "encuestas_satisfaccion" (
  "id"            TEXT NOT NULL,
  -- Con qué obra tiene que ver. Nulo si la instalación se borró: la
  -- respuesta sigue valiendo para el promedio.
  "instalacionId" TEXT,
  "clienteId"     TEXT,
  -- De quién fue la venta. Se copia al crearla porque el cliente puede
  -- cambiar de asesor después y eso falsearía el informe.
  "vendedorId"    TEXT,

  -- El secreto del enlace del correo.
  "token"         TEXT NOT NULL,

  -- ── NPS ──
  "recomendaria"  INTEGER,

  -- ── Los seis puntajes del formato, de 0 a 10 ──
  "calidad"          INTEGER,
  "precio"           INTEGER,
  "profesionalidad"  INTEGER,
  "atencion"         INTEGER,
  "puntualidad"      INTEGER,
  "limpieza"         INTEGER,

  -- ── Recompra y texto libre ──
  "recompra"      INTEGER,
  "destacaria"    TEXT,
  "recomendaciones" TEXT,

  -- Cuándo se mandó y cuándo contestó. Las dos fechas separadas: sin
  -- ellas no se puede saber cuántas se responden ni en cuánto tiempo.
  "enviadaEn"     TIMESTAMP(3),
  "respondidaEn"  TIMESTAMP(3),

  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "encuestas_satisfaccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "encuestas_satisfaccion_token_key"
  ON "encuestas_satisfaccion" ("token");
CREATE INDEX IF NOT EXISTS "encuestas_satisfaccion_instalacionId_idx"
  ON "encuestas_satisfaccion" ("instalacionId");
CREATE INDEX IF NOT EXISTS "encuestas_satisfaccion_respondidaEn_idx"
  ON "encuestas_satisfaccion" ("respondidaEn");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encuestas_satisfaccion_instalacionId_fkey') THEN
    ALTER TABLE "encuestas_satisfaccion" ADD CONSTRAINT "encuestas_satisfaccion_instalacionId_fkey"
      FOREIGN KEY ("instalacionId") REFERENCES "instalaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encuestas_satisfaccion_clienteId_fkey') THEN
    ALTER TABLE "encuestas_satisfaccion" ADD CONSTRAINT "encuestas_satisfaccion_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
