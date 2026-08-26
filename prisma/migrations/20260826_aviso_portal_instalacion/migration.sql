-- ============================================================
-- Sello aparte para la notificación del portal de una instalación.
--
-- Bug encontrado al probar el aviso al coordinador por primera vez
-- (scripts/probar-instalaciones.ts, 26-ago-2026):
--
-- `avisoCoordinadorEn` sella el aviso ENTERO, pero solo se pone cuando
-- el correo sale o cuando no hay a quién escribirle. Con un coordinador
-- configurado y el SMTP sin cargar —que es exactamente la situación de
-- hoy— no se sella nunca, a propósito, para que el correo salga cuando
-- lleguen las credenciales. El efecto colateral: cada reaprobación de la
-- cotización vuelve a crear la notificación del portal. Tres pasadas,
-- tres notificaciones iguales.
--
-- Son dos cosas distintas y necesitan dos sellos: que el aviso interno
-- ya se creó, y que el correo ya salió.
-- ============================================================

ALTER TABLE "instalaciones"
  ADD COLUMN IF NOT EXISTS "avisoPortalEn" TIMESTAMP(3);
