-- Celular del asesor.
--
-- Aditivo y nullable. Sale en la cotizacion junto al nombre del asesor y
-- es el numero al que apunta el boton de WhatsApp que ve el cliente en la
-- oferta publica: sin esto el cliente le escribe al telefono general de la
-- empresa y se pierde el hilo con quien lo venia atendiendo.

ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "telefono" TEXT;
