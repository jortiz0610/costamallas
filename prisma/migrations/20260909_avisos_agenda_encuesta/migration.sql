-- ============================================================
-- Los dos sellos que faltaban para que salgan solos dos correos.
--
-- Las plantillas «Visita técnica agendada» y «Encuesta de satisfacción»
-- llevaban meses escritas y sin nadie que las llamara: el asesor tenía
-- que acordarse de avisar al cliente, y la encuesta simplemente no se
-- mandaba. Ahora las dispara la corrida, y para eso hace falta saber a
-- quién ya se le escribió.
--
-- Se hace con sellos y no con un estado nuevo porque la pregunta no es
-- "en qué punto está la obra" sino "¿ya salió ESTE correo?". Son dos
-- cosas distintas y mezclarlas obliga a inventar estados que no existen
-- en el proceso real.
--
-- Los dos nacen NULOS, incluso en las obras que ya están cerradas. Es
-- deliberado y hay que saberlo: la primera corrida después de desplegar
-- esto vería como "pendientes" todas las entregas viejas y mandaría una
-- encuesta a cada cliente de los últimos meses. Por eso el código NO
-- mira hacia atrás sin límite — solo los últimos días. Ver
-- lib/avisos-operacion.ts.
-- ============================================================

ALTER TABLE "instalaciones"
  ADD COLUMN IF NOT EXISTS "avisoAgendadaEn"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "encuestaEnviadaEn" TIMESTAMP(3);

-- La corrida busca por estas dos columnas cada 15 minutos, filtrando
-- por nulo. Sin índice es un recorrido completo de la tabla cada vez.
CREATE INDEX IF NOT EXISTS "instalaciones_avisoAgendadaEn_idx"
  ON "instalaciones" ("avisoAgendadaEn");

CREATE INDEX IF NOT EXISTS "instalaciones_encuestaEnviadaEn_idx"
  ON "instalaciones" ("encuestaEnviadaEn");
