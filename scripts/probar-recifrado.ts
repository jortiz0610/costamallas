// ============================================================
// El cambio de llave, sin tocar la base.
//
//   npx tsx scripts/probar-recifrado.ts
//
// NO se conecta a nada. Comprueba lo único que puede salir realmente
// mal en lib/recifrado.ts: que el texto sobreviva al cambio de llave,
// que correrlo dos veces no rompa nada, y que lo que no descifra se
// declare fallido en vez de guardarse hecho un desastre.
//
// Es la prueba que tiene que pasar ANTES de correr el re-cifrado contra
// producción, porque ahí no hay segunda oportunidad: si una fila se
// guarda mal, ese secreto ya no vuelve.
// ============================================================

import { randomBytes } from "node:crypto";

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

async function main() {
  const { cifrarCon, descifrarCon } = await import("../src/lib/encryption");
  const { cambiarLlave } = await import("../src/lib/recifrado");

  const vieja = randomBytes(32).toString("hex");
  const nueva = randomBytes(32).toString("hex");
  const otra  = randomBytes(32).toString("hex");

  console.log("\n═══ 1. Ida y vuelta ═══\n");

  const secreto = "clave-del-smtp-con-eñes-y-símbolos-#$%&";
  const conVieja = cifrarCon(vieja, secreto);
  comprobar("lo cifrado no se parece al original", !conVieja.includes(secreto));
  comprobar("y descifra con su llave", descifrarCon(vieja, conVieja) === secreto);

  console.log("\n═══ 2. El cambio de llave ═══\n");

  const r = cambiarLlave(conVieja, vieja, nueva);
  comprobar("dice que lo recifro", r.estado === "recifrado", r.estado);
  if (r.estado !== "recifrado") { console.log("\n  Sin esto no tiene sentido seguir.\n"); process.exit(1); }

  comprobar("el texto SOBREVIVE intacto", descifrarCon(nueva, r.texto) === secreto);
  comprobar("y la llave vieja ya no lo abre", (() => {
    try { descifrarCon(vieja, r.texto); return false; } catch { return true; }
  })());

  console.log("\n═══ 3. Correrlo dos veces ═══\n");

  // Esto es lo que salva de un reintento: si la ruta se llama otra vez
  // —o alguien le da dos clics—, la segunda pasada NO puede volver a
  // cifrar lo ya cifrado.
  const segunda = cambiarLlave(r.texto, vieja, nueva);
  comprobar("la segunda pasada dice 'ya estaba'", segunda.estado === "ya", segunda.estado);
  comprobar("y el texto sigue descifrando", descifrarCon(nueva, r.texto) === secreto);

  console.log("\n═══ 4. Lo que no se puede descifrar ═══\n");

  const ajeno = cifrarCon(otra, "cifrado con una tercera llave");
  const conAjeno = cambiarLlave(ajeno, vieja, nueva);
  comprobar("se declara fallido", conAjeno.estado === "fallo", conAjeno.estado);
  comprobar("y NO devuelve texto para guardar", !("texto" in conAjeno));
  comprobar("el original queda intacto", descifrarCon(otra, ajeno) === "cifrado con una tercera llave");

  const basura = cambiarLlave("esto no es texto cifrado", vieja, nueva);
  comprobar("la basura tambien es fallo, no excepcion", basura.estado === "fallo", basura.estado);

  console.log("\n═══ 5. El caso del doble factor ═══\n");

  // Las filas de 2FA guardan { secretEnc, enabled, required } y el
  // cifrado va DENTRO. Se comprueba que el envoltorio no se pierde.
  const estado = { secretEnc: cifrarCon(vieja, "JBSWY3DPEHPK3PXP"), enabled: true, required: false };
  const dentro = cambiarLlave(estado.secretEnc, vieja, nueva);
  comprobar("el secreto de dentro se recifra", dentro.estado === "recifrado");
  if (dentro.estado === "recifrado") {
    const guardado = JSON.stringify({ ...estado, secretEnc: dentro.texto });
    const leido = JSON.parse(guardado);
    comprobar("y el envoltorio conserva enabled", leido.enabled === true);
    comprobar("y conserva required", leido.required === false);
    comprobar("y el secreto sale igual", descifrarCon(nueva, leido.secretEnc) === "JBSWY3DPEHPK3PXP");
  }

  console.log("\n═══ 6. La segunda llave, durante la mudanza ═══\n");

  // decrypt() prueba ENCRYPTION_KEY_ALTERNA cuando la principal no abre.
  // Es lo que evita que haya un rato sin correo y sin doble factor
  // mientras se cambia la llave.
  const { decrypt } = await import("../src/lib/encryption");
  process.env.ENCRYPTION_KEY = nueva;
  delete process.env.ENCRYPTION_KEY_ALTERNA;

  const conNueva = cifrarCon(nueva, "hola");
  comprobar("la principal abre lo suyo", decrypt(conNueva) === "hola");
  comprobar("y sin alterna, lo de la llave vieja NO abre", (() => {
    try { decrypt(conVieja); return false; } catch { return true; }
  })());

  process.env.ENCRYPTION_KEY_ALTERNA = vieja;
  comprobar("con la alterna puesta, si abre lo de la vieja", decrypt(conVieja) === secreto);
  comprobar("y lo de la nueva sigue abriendo", decrypt(conNueva) === "hola");
  comprobar("lo de una tercera llave sigue fallando", (() => {
    try { decrypt(ajeno); return false; } catch { return true; }
  })());

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
