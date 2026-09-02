-- ============================================================
-- Selección de proveedores y contratistas.
--
-- Es el formulario que hoy vive en Google Forms. Traerlo al portal no es
-- por gusto: en Forms las respuestas quedan en una hoja aparte, así que
-- para saber si un proveedor está aprobado hay que abrir otra pestaña y
-- buscarlo a mano. Aquí queda colgado del proveedor, y la ficha dice
-- sola si pasó o no.
--
-- El puntaje está en el propio formato: cada opción vale un porcentaje.
-- Se calcula solo, que es lo que en la hoja se hacía con una fórmula que
-- nadie revisa.
--
-- Aditivo. Tabla nueva, nada que migrar.
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluaciones_proveedor (
  id            TEXT PRIMARY KEY,

  -- Se puede evaluar a alguien que todavía no está en la lista de
  -- proveedores: el formato es de SELECCIÓN, va antes de contratarlo.
  "proveedorId" TEXT,

  -- ── Identificación ──
  -- NATURAL · JURIDICA
  tipo          TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  documento     TEXT NOT NULL,

  -- ── Criterios ──
  -- Cada uno: SI (100) · NO (0) · NA (no cuenta para el promedio).
  -- [{ clave, texto, valor }]
  documentos    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- INMEDIATA(100) · DIAS_1_3(90) · DIAS_4_7(70) · MAS_7(50)
  "tiempoEntrega" TEXT,
  -- CONTADO(70) · CREDITO_30(85) · CREDITO_45(90) · CREDITO_60(100)
  "opcionPago"    TEXT,

  -- El puntaje total, de 0 a 100. Se guarda calculado para poder
  -- ordenar y filtrar sin recalcular cada vez.
  puntaje       DOUBLE PRECISION,

  -- ── Visto bueno ──
  -- Solo lo diligencia la gerencia administrativa, igual que en el papel.
  aprobado      BOOLEAN,
  "aprobadoPor" TEXT,
  "aprobadoEn"  TIMESTAMP(3),
  "notaGerencia" TEXT,

  "creadoPor"   TEXT,
  "esPrueba"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT evaluaciones_proveedor_proveedor_fkey
    FOREIGN KEY ("proveedorId") REFERENCES proveedores(id) ON DELETE SET NULL,
  CONSTRAINT evaluaciones_proveedor_aprobadopor_fkey
    FOREIGN KEY ("aprobadoPor") REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "evaluaciones_proveedor_proveedorId_idx" ON evaluaciones_proveedor ("proveedorId");
CREATE INDEX IF NOT EXISTS "evaluaciones_proveedor_aprobado_idx"    ON evaluaciones_proveedor (aprobado);
CREATE INDEX IF NOT EXISTS "evaluaciones_proveedor_esPrueba_idx"    ON evaluaciones_proveedor ("esPrueba");
