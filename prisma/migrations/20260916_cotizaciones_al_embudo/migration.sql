-- ============================================================
-- Las cotizaciones de SIIGO entran al embudo.
--
-- Estuvieron apartadas en un estado propio (`HISTORICA`) para que 6.323
-- ofertas viejas no enterraran las que se están trabajando. Se decidió
-- unirlas: son ofertas reales de clientes reales, no se van a traer más,
-- y tenerlas en otro sitio obligaba a mirar dos listas para responder la
-- misma pregunta.
--
-- El estado NO se inventa: sale de la fecha del documento. Si ya pasó su
-- validez está VENCIDA; si no, quedó ENVIADA — una cotización de SIIGO
-- es un documento que se le ENTREGÓ a un cliente, no un borrador.
--
-- Lo único que las distingue a partir de ahora es `siigoId`, que ya
-- tienen, y que la pantalla pinta como una marca.
-- ============================================================

UPDATE "cotizaciones"
SET "estado" = CASE
  WHEN "createdAt" + ("validezDias" || ' days')::interval < now() THEN 'VENCIDA'
  ELSE 'ENVIADA'
END
WHERE "estado" = 'HISTORICA';
