-- Cotizacion 2.0: dos plantillas, enlace publico, envio e instalacion con precio.
--
-- Cambio puramente aditivo: no borra ni modifica datos existentes. Las
-- cotizaciones que ya existen quedan como EXPRESS, sin enlace publico y
-- con sus items marcados como PRODUCTO, que es lo que son hoy.

-- 1. Cotizacion ---------------------------------------------------------

-- EXPRESS (1-2 hojas, producto suelto) o PROPUESTA (dossier con portada).
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "plantilla" TEXT NOT NULL DEFAULT 'EXPRESS';

-- Enlace publico. El token es distinto del id para que nadie llegue a una
-- cotizacion ajena cambiando un caracter en la URL.
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "vistaPrimeraEn" TIMESTAMP(3);
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "vistaUltimaEn" TIMESTAMP(3);
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "vistas" INTEGER NOT NULL DEFAULT 0;

-- Envio al cliente.
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "enviadaEn" TIMESTAMP(3);
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "enviadaAEmail" TEXT;
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "errorEnvio" TEXT;

-- Donde se instala: define el recargo por desplazamiento y sale en el PDF.
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "ciudadInstalacion" TEXT;
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "direccionInstalacion" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "cotizaciones_publicId_key" ON "cotizaciones"("publicId");

-- 2. Items --------------------------------------------------------------

-- PRODUCTO o INSTALACION. La instalacion va como item aparte porque su
-- precio no depende solo del producto, sino tambien de la ciudad.
ALTER TABLE "items_cotizacion" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'PRODUCTO';
-- La foto se copia del catalogo al cotizar: si despues cambian la imagen
-- del producto, la oferta que ya se envio no cambia sola.
ALTER TABLE "items_cotizacion" ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT;
ALTER TABLE "items_cotizacion" ADD COLUMN IF NOT EXISTS "detalle" TEXT;

-- 3. Catalogo de instalacion --------------------------------------------

CREATE TABLE IF NOT EXISTS "servicios_instalacion" (
  "id"          TEXT NOT NULL,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "unidad"      TEXT NOT NULL DEFAULT 'm2',
  "precioBase"  DECIMAL(14,2) NOT NULL DEFAULT 0,
  "categorias"  TEXT[] DEFAULT ARRAY[]::TEXT[],
  "minimoCobro" DECIMAL(10,2),
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "orden"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "servicios_instalacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "servicios_instalacion_activo_idx" ON "servicios_instalacion"("activo");

-- Recargo por desplazamiento fuera de la ciudad base (viaticos): no vale
-- lo mismo instalar en Barranquilla que mandar el personal a Santa Marta.
CREATE TABLE IF NOT EXISTS "recargos_ciudad" (
  "id"           TEXT NOT NULL,
  "ciudad"       TEXT NOT NULL,
  "departamento" TEXT,
  "porcentaje"   DECIMAL(5,2) NOT NULL DEFAULT 0,
  "montoFijo"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "activo"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recargos_ciudad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recargos_ciudad_ciudad_key" ON "recargos_ciudad"("ciudad");
