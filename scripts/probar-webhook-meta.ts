// ============================================================
// ¿Entendemos lo que manda Meta?
//
//   npx tsx scripts/probar-webhook-meta.ts
//
// Solo lógica: no toca la base ni la red. Los payloads son los que
// documenta WhatsApp Cloud API, copiados con su forma real —anidados y
// con varios mensajes por petición—, que es justo lo que el webhook NO
// entendía.
// ============================================================

import { mensajesDeMeta, esPayloadDeMeta } from "../src/lib/nexus/meta-webhook";

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

const sobre = (value: unknown, field = "messages") => ({
  object: "whatsapp_business_account",
  entry: [{ id: "102...", changes: [{ field, value }] }],
});

const meta = { display_phone_number: "573006078956", phone_number_id: "109371234567890" };

function main() {
  console.log("\n═══ 1. Un mensaje de texto ═══\n");

  const texto = mensajesDeMeta(sobre({
    messaging_product: "whatsapp",
    metadata: meta,
    contacts: [{ profile: { name: "María García" }, wa_id: "573001112233" }],
    messages: [{
      from: "573001112233", id: "wamid.AAA", timestamp: "1756700000",
      type: "text", text: { body: "¿Cuánto vale la malla para balcón?" },
    }],
  }));

  comprobar("llega un mensaje", texto.length === 1, String(texto.length));
  comprobar("con el teléfono del cliente", texto[0]?.telefono === "573001112233", texto[0]?.telefono);
  comprobar("con su NOMBRE, no 'WhatsApp'", texto[0]?.remitente === "María García", texto[0]?.remitente);
  comprobar("y con el texto entero",
    texto[0]?.contenido === "¿Cuánto vale la malla para balcón?", texto[0]?.contenido);
  comprobar("guarda el wamid para no duplicarlo", texto[0]?.refExterna === "wamid.AAA");

  console.log("\n═══ 2. Lo que antes se perdía ═══\n");

  // Un acuse de entrega. Antes abría una conversación en blanco.
  const acuse = mensajesDeMeta(sobre({
    messaging_product: "whatsapp", metadata: meta,
    statuses: [{ id: "wamid.AAA", status: "delivered", recipient_id: "573001112233" }],
  }));
  comprobar("un acuse de entrega NO es un mensaje", acuse.length === 0, String(acuse.length));

  // Meta agrupa. Antes solo se leía el primero... y ni ese.
  const varios = mensajesDeMeta(sobre({
    messaging_product: "whatsapp", metadata: meta,
    contacts: [{ profile: { name: "Pedro" }, wa_id: "573002223344" }],
    messages: [
      { from: "573002223344", id: "wamid.B1", type: "text", text: { body: "Buenas" } },
      { from: "573002223344", id: "wamid.B2", type: "text", text: { body: "Es para un balcón de 3m" } },
    ],
  }));
  comprobar("dos mensajes en una petición llegan los dos", varios.length === 2, String(varios.length));
  comprobar("y en orden", varios[1]?.contenido.includes("3m") === true);

  // Otros campos del webhook no son conversaciones.
  const plantilla = mensajesDeMeta(sobre({ event: "APPROVED" }, "message_template_status_update"));
  comprobar("una actualización de plantilla no entra a la bandeja", plantilla.length === 0);

  console.log("\n═══ 3. Los tipos que no son texto ═══\n");

  const uno = (m: Record<string, unknown>) => mensajesDeMeta(sobre({
    messaging_product: "whatsapp", metadata: meta,
    contacts: [{ profile: { name: "Ana" }, wa_id: "573004445566" }],
    messages: [{ from: "573004445566", id: "wamid.C", ...m }],
  }))[0];

  const audio = uno({ type: "audio", audio: { id: "media-1", mime_type: "audio/ogg", voice: true } });
  comprobar("una nota de voz se ve como nota de voz", audio?.contenido === "🎤 Nota de voz", audio?.contenido);
  comprobar("y guarda el id del archivo para bajarlo después",
    (audio?.metadata as { adjunto?: string })?.adjunto === "media-1");
  comprobar("con su tipo", audio?.tipo === "audio", audio?.tipo);

  const foto = uno({ type: "image", image: { id: "media-2", caption: "Así quedó el balcón" } });
  comprobar("una foto con texto muestra el texto", foto?.contenido === "Así quedó el balcón", foto?.contenido);

  const fotoSola = uno({ type: "image", image: { id: "media-3" } });
  comprobar("y una sin texto no queda en blanco", fotoSola?.contenido === "📷 Imagen", fotoSola?.contenido);

  const doc = uno({ type: "document", document: { id: "m4", filename: "medidas.pdf" } });
  comprobar("un documento dice cómo se llama", doc?.contenido.includes("medidas.pdf") === true, doc?.contenido);

  const ubi = uno({ type: "location", location: { latitude: 3.42, longitude: -76.52, name: "Casa" } });
  comprobar("una ubicación trae enlace a mapas",
    ubi?.contenido.includes("maps.google.com") === true, ubi?.contenido);

  const boton = uno({ type: "button", button: { text: "Sí, me interesa" } });
  comprobar("un botón de plantilla dice QUÉ tocó",
    boton?.contenido === "Sí, me interesa", boton?.contenido);

  const raro = uno({ type: "sistema_nuevo_de_meta" });
  comprobar("un tipo desconocido no revienta ni queda vacío",
    (raro?.contenido ?? "").length > 0, raro?.contenido);

  console.log("\n═══ 4. Sin nombre de perfil ═══\n");

  const anon = mensajesDeMeta(sobre({
    messaging_product: "whatsapp", metadata: meta,
    messages: [{ from: "573009998877", id: "wamid.D", type: "text", text: { body: "hola" } }],
  }));
  comprobar("si no comparte nombre, se usa el número",
    anon[0]?.remitente === "573009998877", anon[0]?.remitente);

  console.log("\n═══ 5. Lo que NO es de Meta sigue su camino ═══\n");

  comprobar("un cuerpo plano no se confunde con Meta",
    !esPayloadDeMeta({ from: "573001112233", body: "hola" }));
  comprobar("un cuerpo vacío tampoco", !esPayloadDeMeta({}));
  comprobar("ni null", !esPayloadDeMeta(null));
  comprobar("un payload de Meta sí se reconoce",
    esPayloadDeMeta(sobre({ messaging_product: "whatsapp", metadata: meta })));

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main();
