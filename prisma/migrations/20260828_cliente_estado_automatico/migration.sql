-- ============================================================
-- El estado del cliente pasa a ser CALCULADO.
--
-- Hasta hoy era un desplegable que alguien elegía a mano, con siete
-- valores. Lo que se veía en la base: 19 CLIENTE_ACTIVO, 9 INTERESADO,
-- 2 RECURRENTE y 1 PROSPECTO — es decir, casi todo el mundo "activo",
-- porque nadie vuelve a una ficha a degradar a un cliente que dejó de
-- comprar. Un campo que solo sube no informa de nada.
--
-- Ahora el estado sale de los hechos (lo calcula `lib/estados-cliente`)
-- y esta migración solo prepara el terreno:
--
--   1. Dos columnas nuevas para poder explicarlo en pantalla: cuándo fue
--      la última señal de vida del cliente y cuándo se recalculó.
--   2. Traducción de los tres estados que se retiran, para que ninguna
--      ficha quede con una etiqueta que ya no existe. Es un valor
--      PROVISIONAL: el primer recálculo lo corrige con los datos reales.
--
--        CALIFICADO     → INTERESADO      (pidió, no cerró)
--        RECURRENTE     → CLIENTE_ACTIVO  (los 2 que hay; si además son
--                                          empresa con más de 5 ofertas
--                                          aprobadas, el recálculo los
--                                          sube a VIP)
--        NO_CALIFICADO  → EN_SEGUIMIENTO  (el nombre nuevo)
--
-- Aditivo. No se borra ninguna columna ni ningún cliente.
-- ============================================================

ALTER TABLE "clientes"
  -- Lo más reciente de todo lo que cuenta como señal de vida: una
  -- cotización, un pedido o un mensaje en el chat. Se guarda en vez de
  -- calcularse en cada consulta porque es lo que ordena la lista y lo
  -- que decide si alguien lleva seis meses callado.
  ADD COLUMN IF NOT EXISTS "ultimaInteraccionEn" TIMESTAMP(3),
  -- Cuándo se recalculó por última vez. Sin esto, un estado raro no se
  -- puede distinguir de un estado viejo.
  ADD COLUMN IF NOT EXISTS "estadoCalculadoEn"   TIMESTAMP(3);

UPDATE "clientes" SET "estado" = 'INTERESADO'     WHERE "estado" = 'CALIFICADO';
UPDATE "clientes" SET "estado" = 'CLIENTE_ACTIVO' WHERE "estado" = 'RECURRENTE';
UPDATE "clientes" SET "estado" = 'EN_SEGUIMIENTO' WHERE "estado" = 'NO_CALIFICADO';
