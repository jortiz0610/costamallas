-- Cedula del cliente persona natural.
--
-- Aditivo y nullable. La ficha solo tenia `nit`, y ademas solo se pedia
-- cuando el cliente era una empresa: un cliente persona natural quedaba
-- sin ningun numero de identificacion. Eso no es un capricho de
-- formulario — sin identificacion no se le puede facturar.
--
-- Se agrega columna aparte en vez de reusar `nit` para no mezclar dos
-- cosas que la DIAN trata distinto y que se muestran con etiquetas
-- distintas en la cotizacion.

ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "cedula" TEXT;
