-- ============================================================
-- El rol OPERARIO y la Orden de Producción de Malla Ciclón.
--
-- Es el formato que hoy se llena en papel: qué malla se va a fabricar,
-- con qué materia prima, qué salió, cuánto se desperdició, qué paradas
-- hubo y si se generó producto no conforme. Lo firma el operario y lo
-- firma el supervisor.
--
-- Por qué un rol nuevo y no PRODUCCION: no son lo mismo. PRODUCCIÓN
-- coordina —ve el pipeline, agenda instalaciones, habla con el CRM—; el
-- OPERARIO fabrica. Meterlo en PRODUCCION le habría dado acceso a
-- clientes y pedidos para poder llenar un formato de taller.
--
-- Aditivo. El valor del enum se agrega; los datos existentes no se tocan.
-- ============================================================

-- Postgres no admite ADD VALUE dentro de una transacción implícita en
-- algunas versiones, así que va con IF NOT EXISTS y suelto.
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'OPERARIO';

CREATE TABLE IF NOT EXISTS ordenes_produccion (
  id             TEXT PRIMARY KEY,
  numero         TEXT NOT NULL UNIQUE,

  -- Cabecera del formato
  "fechaExpedicion"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "fechaPrevista"    TIMESTAMP(3),
  estado             TEXT NOT NULL DEFAULT 'ABIERTA',

  -- De dónde viene, cuando viene de una venta. Puede ser nula: también
  -- se fabrica para reponer inventario, sin pedido detrás.
  "pedidoId"     TEXT,
  "productoId"   TEXT,

  -- Quién la hace y quién la revisa
  "operarioId"   TEXT,
  "supervisorId" TEXT,

  -- ── ESPECIFICACIÓN DE LA MALLA ──
  -- Hasta tres presentaciones (A, B, C) en el papel:
  -- [{ fila, ref, colorGalv, calibre, ojo, alto, largo, m2,
  --    cant1, largo1, peso, cant2, largo2 }]
  especificacion JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── MATERIA PRIMA O INSUMOS ──
  -- [{ n, colorGalv, calibre, ordenCompraLote,
  --    kgRecibida, kgUtilizada, kgDesperdicio, kgDevuelta }]
  "materiaPrima" JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── PRODUCTO TERMINADO (rollos) ──
  -- [{ n, ref, alto, largo, peso, diametro, m2 }]
  "productoTerminado" JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── TIEMPO DE INTERRUPCIONES Y/O PARADAS ──
  -- [{ n, horaInicio, horaFinal, motivo }]
  interrupciones JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── PRODUCTO NO CONFORME ──
  "generaPnc"     BOOLEAN NOT NULL DEFAULT false,
  "atributoNc"    TEXT,
  "pncKg"         DOUBLE PRECISION,
  -- RETENCION_REPROCESO · REPARACION · CONCESION ·
  -- RECLASIFICACION_APROVECHAMIENTO · DESTRUCCION
  "pncTratamiento" TEXT,

  -- Inspección al producto en proceso (verificación de especificaciones)
  inspeccion     TEXT,
  observaciones  TEXT,

  -- ── Firmas ──
  -- El mismo mecanismo que el acta de entrega: PNG en base64.
  "firmaOperario"      TEXT,
  "firmaOperarioNombre" TEXT,
  "firmaOperarioEn"    TIMESTAMP(3),
  "firmaSupervisor"    TEXT,
  "firmaSupervisorNombre" TEXT,
  "firmaSupervisorEn"  TIMESTAMP(3),

  "esPrueba"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT ordenes_produccion_pedido_fkey
    FOREIGN KEY ("pedidoId") REFERENCES pedidos(id) ON DELETE SET NULL,
  CONSTRAINT ordenes_produccion_producto_fkey
    FOREIGN KEY ("productoId") REFERENCES productos(id) ON DELETE SET NULL,
  CONSTRAINT ordenes_produccion_operario_fkey
    FOREIGN KEY ("operarioId") REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT ordenes_produccion_supervisor_fkey
    FOREIGN KEY ("supervisorId") REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ordenes_produccion_estado_idx"     ON ordenes_produccion (estado);
CREATE INDEX IF NOT EXISTS "ordenes_produccion_operarioId_idx" ON ordenes_produccion ("operarioId");
CREATE INDEX IF NOT EXISTS "ordenes_produccion_pedidoId_idx"   ON ordenes_produccion ("pedidoId");
CREATE INDEX IF NOT EXISTS "ordenes_produccion_esPrueba_idx"   ON ordenes_produccion ("esPrueba");

-- Su propio consecutivo: una OP no es una cotización ni un pedido.
INSERT INTO configuracion (id, clave, valor, encrypted, descripcion, "updatedAt")
VALUES (gen_random_uuid()::text, 'consecutivo_orden_produccion', '0', false,
        'Ultimo numero de orden de produccion emitido', NOW())
ON CONFLICT (clave) DO NOTHING;
