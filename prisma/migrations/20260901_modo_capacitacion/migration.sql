-- ============================================================
-- Modo capacitación: la marca de prueba empieza en el CLIENTE.
--
-- Hasta ahora "prueba" era una casilla de la cotización, y por eso el
-- ensayo se moría ahí: el pedido nacía marcado pero el pipeline lo
-- escondía, así que no había dónde seguir el proceso.
--
-- Ahora se marca UN cliente, y todo lo que cuelgue de él —cotizaciones,
-- pedidos, visitas, instalaciones, facturas— nace marcado y recorre el
-- proceso completo, igual que uno real, sin ensuciar informes ni quemar
-- consecutivos.
--
-- Aditivo e idempotente. Ninguna columna nueva es obligatoria: todo lo
-- que ya existe queda en `false`, que es exactamente lo que era.
-- ============================================================

ALTER TABLE clientes      ADD COLUMN IF NOT EXISTS "esPrueba" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS "esPrueba" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE facturas      ADD COLUMN IF NOT EXISTS "esPrueba" BOOLEAN NOT NULL DEFAULT false;

-- Se consulta siempre en el mismo sentido: "dame lo que NO es prueba".
CREATE INDEX IF NOT EXISTS "clientes_esPrueba_idx"      ON clientes      ("esPrueba");
CREATE INDEX IF NOT EXISTS "instalaciones_esPrueba_idx" ON instalaciones ("esPrueba");
CREATE INDEX IF NOT EXISTS "facturas_esPrueba_idx"      ON facturas      ("esPrueba");

-- El contador de pedidos de prueba. Sin él, aprobar una cotización de
-- ensayo quemaba un número del consecutivo real de PED.
INSERT INTO configuracion (id, clave, valor, encrypted, descripcion, "updatedAt")
VALUES (gen_random_uuid()::text, 'consecutivo_prueba_ped', '0', false,
        'Contador de pedidos de prueba (numeracion aparte)', NOW())
ON CONFLICT (clave) DO NOTHING;
