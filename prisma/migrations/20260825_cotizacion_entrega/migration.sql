-- Tiempo de entrega propio de una cotizacion.
--
-- Aditivo y nullable: NULL = se usa el texto general de
-- Configuracion -> Cotizacion, que es como funciona hoy.
--
-- El texto general dice "de 2 a 5 dias habiles". Hay productos y obras
-- que se demoran 15, y el asesor no tenia forma de cambiarlo en la
-- oferta: se enviaba una promesa que no se iba a cumplir. Prometer mal
-- un plazo cuesta la siguiente compra, no solo esta.

ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "tiempoEntrega" TEXT;
