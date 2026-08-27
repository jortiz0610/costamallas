-- ============================================================
-- AIU en la cotización: Administración, Imprevistos y Utilidad.
--
-- El portal cobraba 19 % de IVA sobre TODO el subtotal. En una obra eso
-- no es lo que Costamallas factura: en la cotización real de un
-- cerramiento de 1.350 m² el IVA va sobre la UTILIDAD, no sobre el
-- contrato. La diferencia medida contra esa hoja: $22.617.821 contra
-- $2.261.782 — diez veces.
--
-- Cómo queda:
--   base del AIU  = subtotal de los ítems de INSTALACIÓN (la obra)
--   A, I, U       = porcentaje sobre esa base, con el monto editable
--                   (en las hojas de la empresa la administración y los
--                   imprevistos se negocian como suma fija, no salen
--                   siempre de un porcentaje exacto)
--   IVA           = 19 % del material  +  19 % de la utilidad
--
-- `aiuActivo` nace en FALSE: las cotizaciones de material suelto siguen
-- calculándose exactamente igual que hoy, y las que ya existen no
-- cambian de total.
--
-- Se guardan el porcentaje Y el monto de cada componente. El monto es la
-- verdad —es lo que se cobra—; el porcentaje queda para poder mostrarlo
-- en el documento, que es como lo lee el cliente.
--
-- Aditivo. Ninguna columna existente se toca.
-- ============================================================

ALTER TABLE "cotizaciones"
  ADD COLUMN IF NOT EXISTS "aiuActivo"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiuAdminPct"    DECIMAL(5,2)  NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "aiuImprevPct"   DECIMAL(5,2)  NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "aiuUtilidadPct" DECIMAL(5,2)  NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "aiuAdmin"       DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiuImprev"      DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiuUtilidad"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  -- Parte del IVA que corresponde a la utilidad. `iva` sigue siendo el
  -- IVA TOTAL, para no romper cartera, facturación ni los reportes que
  -- ya lo leen.
  ADD COLUMN IF NOT EXISTS "ivaUtilidad"    DECIMAL(14,2) NOT NULL DEFAULT 0;
