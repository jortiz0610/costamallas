-- Nivel CLIENTE de Sembli: login del cliente final.
--
-- Cambio puramente aditivo: no borra ni modifica datos existentes.
--   1. Nuevo valor 'CLIENTE' en el enum Rol.
--   2. Columna usuarios.clienteId (acepta nulos) que ata un login a una
--      ficha del CRM. Sembli usa ese vínculo para mostrarle al cliente
--      únicamente SUS pedidos y cotizaciones.
--   3. ON DELETE SET NULL: si se borra el cliente del CRM, el usuario
--      queda sin vínculo en vez de desaparecer.

ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'CLIENTE';

ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "clienteId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_clienteId_fkey'
  ) THEN
    ALTER TABLE "usuarios"
      ADD CONSTRAINT "usuarios_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "usuarios_clienteId_idx" ON "usuarios"("clienteId");
