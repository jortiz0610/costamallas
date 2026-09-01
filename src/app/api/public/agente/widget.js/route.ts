// ============================================================
// GET /api/public/agente/widget.js — el chat que se pega en WordPress
//
// Se sirve desde aquí y no como un archivo del tema para que cambiarlo
// no dependa de tocar WordPress: en la tienda solo va una etiqueta
// <script> que nunca hay que volver a editar.
//
// Se entrega sin envolver en ningún framework: es un <script> suelto en
// una página de WordPress con jQuery, Elementor y lo que haya. Todo va
// dentro de una IIFE y los estilos dentro de un shadow DOM, para que el
// tema no le pise el CSS ni el widget le pise nada al tema.
//
// El texto que llega del servidor se inserta con textContent, nunca con
// innerHTML: es contenido generado por un modelo a partir de lo que
// escribe un desconocido en internet.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getConfigAgenteWeb } from "@/lib/agente-web/config";
import { getMarca } from "@/lib/marca";
import { urlPortal } from "@/lib/url-portal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const [cfg, marca] = await Promise.all([getConfigAgenteWeb(), getMarca()]);
  // NO se usa NEXT_PUBLIC_APP_URL: apunta a la TIENDA, y con ella el
  // widget le hablaba a costamallas.com/api/public/agente → 404.
  const base = urlPortal(req);

  const datos = JSON.stringify({
    api: `${base}/api/public/agente`,
    nombre: cfg.nombre,
    saludo: cfg.saludo,
    empresa: marca.companyName,
    color: marca.brandColor || "#ffdd00",
    whatsapp: cfg.whatsapp,
    activo: cfg.activo,
  });

  const js = `(function () {
  "use strict";
  var CFG = ${datos};
  if (!CFG.activo) return;
  if (window.__costamallasAgente) return;   // que dos <script> no pinten dos burbujas
  window.__costamallasAgente = true;

  var NEGRO = "#11110f";
  // El token va en sessionStorage y NO en localStorage: cada visita
  // nueva abre una conversación nueva. Con localStorage, alguien que
  // volvía tres semanas después seguía escribiendo dentro del mismo hilo
  // —debajo de una consulta ya cerrada— y en la bandeja parecía que
  // nunca pasaba nada nuevo.
  var SS = "costamallas_agente_token";
  // Los DATOS de la persona sí se recuerdan entre visitas: volver a
  // pedirle el nombre a quien ya lo dio es la forma más rápida de que
  // cierre el chat.
  var LSV = "costamallas_agente_visitante";

  var host = document.createElement("div");
  host.style.cssText = "position:fixed;right:0;bottom:0;z-index:2147483000";
  document.body.appendChild(host);
  var raiz = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var estilo = document.createElement("style");
  estilo.textContent = [
    ":host,*{box-sizing:border-box}",
    ".b{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:0;",
    "cursor:pointer;background:" + CFG.color + ";color:" + NEGRO + ";box-shadow:0 6px 22px rgba(0,0,0,.28);",
    "display:flex;align-items:center;justify-content:center;font-size:26px;transition:transform .15s}",
    ".b:hover{transform:scale(1.06)}",
    ".p{position:fixed;right:20px;bottom:88px;width:360px;max-width:calc(100vw - 32px);height:520px;",
    "max-height:calc(100vh - 120px);background:#fff;border-radius:18px;overflow:hidden;display:none;",
    "flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.3);font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif}",
    ".p.on{display:flex}",
    ".h{background:" + NEGRO + ";padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}",
    ".h .t{flex:1;min-width:0}",
    ".h .n{color:#fff;font-weight:800;font-size:14px;margin:0;line-height:1.2}",
    ".h .s{color:" + CFG.color + ";font-size:10px;margin:2px 0 0;text-transform:uppercase;letter-spacing:.1em;font-weight:700}",
    ".h .x{background:0;border:0;color:rgba(255,255,255,.65);font-size:22px;cursor:pointer;line-height:1;padding:0 2px}",
    ".l{height:3px;background:" + CFG.color + ";flex-shrink:0}",
    ".m{flex:1;overflow-y:auto;padding:14px;background:#f7f6f0}",
    ".r{margin-bottom:10px;display:flex}",
    ".r.y{justify-content:flex-end}",
    ".r p{margin:0;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.5;max-width:82%;white-space:pre-wrap;word-wrap:break-word}",
    ".r.a p{background:#fff;color:#2b2d29;border:1px solid #e8e7e0;border-bottom-left-radius:4px}",
    ".r.y p{background:" + NEGRO + ";color:#fff;border-bottom-right-radius:4px}",
    ".r.e p{background:#fffbe6;color:#7a5c00;border:1px solid " + CFG.color + ";font-size:12.5px}",
    ".f{border-top:1px solid #e8e7e0;padding:10px;display:flex;gap:8px;background:#fff;flex-shrink:0}",
    ".f input{flex:1;border:1px solid #ddd;border-radius:11px;padding:10px 12px;font-size:13.5px;outline:0;font-family:inherit}",
    ".f input:focus{border-color:" + NEGRO + "}",
    ".f button{border:0;border-radius:11px;padding:0 15px;background:" + CFG.color + ";color:" + NEGRO + ";font-weight:800;cursor:pointer;font-size:13px}",
    ".f button:disabled{opacity:.45;cursor:default}",
    ".w{display:block;text-align:center;padding:8px;background:#25D366;color:#fff;font-size:12px;font-weight:700;text-decoration:none;flex-shrink:0}",
    ".d{display:flex;gap:4px;padding:9px 12px}",
    ".d i{width:6px;height:6px;border-radius:50%;background:#bbb;animation:p 1.2s infinite}",
    ".d i:nth-child(2){animation-delay:.2s}.d i:nth-child(3){animation-delay:.4s}",
    "@keyframes p{0%,60%,100%{opacity:.3}30%{opacity:1}}",
    "@media(max-width:420px){.p{right:8px;left:8px;width:auto;bottom:80px}}",
    // El registro previo. Ocupa el mismo hueco que la lista de mensajes.
    ".g{flex:1;overflow-y:auto;padding:18px 16px;background:#f7f6f0;display:none}",
    ".g.on{display:block}",
    ".g h4{margin:0 0 4px;font-size:14.5px;color:#11110f;font-weight:800}",
    ".g .sub{margin:0 0 14px;font-size:12.5px;color:#6b6f6a;line-height:1.5}",
    ".g label{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8f88;margin:0 0 4px}",
    ".g input[type=text],.g input[type=email]{width:100%;border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:13.5px;outline:0;font-family:inherit;margin:0 0 12px;background:#fff}",
    ".g input:focus{border-color:" + NEGRO + "}",
    // La casilla de la política ES un <label>, así que hereda el
    // uppercase de la regla de arriba y el texto legal salía gritando.
    // Se le devuelve la forma de una frase.
    ".g .chk{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#6b6f6a;line-height:1.5;margin:2px 0 14px;cursor:pointer;",
    "text-transform:none;letter-spacing:normal;font-weight:400}",
    ".g .chk input{margin:2px 0 0;flex-shrink:0}",
    ".g .chk a{color:#11110f;text-decoration:underline}",
    ".g .go{width:100%;border:0;border-radius:11px;padding:12px;background:" + CFG.color + ";color:" + NEGRO + ";font-weight:800;font-size:13.5px;cursor:pointer}",
    ".g .go:disabled{opacity:.4;cursor:default}",
    ".g .err{margin:8px 0 0;font-size:12px;color:#b91c1c;min-height:16px}",
  ].join("");
  raiz.appendChild(estilo);

  var burbuja = document.createElement("button");
  burbuja.className = "b";
  burbuja.setAttribute("aria-label", "Abrir el chat de " + CFG.empresa);
  // Era el emoji 💬, que cada sistema dibuja distinto: en Windows sale
  // como una nube. Este SVG es dibujado, no bajado de ningún banco de
  // iconos —sin licencia de por medio— y está pensado para leerse a
  // 26 px, que es donde los iconos bonitos se vuelven mugre.
  //
  // Los puntos van del color de la marca porque la burbuja es negra
  // sobre el círculo amarillo. Salen de CFG.color y no escritos a mano,
  // para que cambiar el color de marca no deje tres puntos huérfanos.
  burbuja.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2.75c-5.11 0-9.25 3.44-9.25 7.69 0 2.4 1.33 4.54 3.41 5.95v3.36c0 .53.6.84 1.03.53l3.02-2.17c.58.09 1.18.13 1.79.13 5.11 0 9.25-3.44 9.25-7.8S17.11 2.75 12 2.75Z"/>' +
    '<circle cx="8.2" cy="10.4" r="1.15" fill="' + CFG.color + '"/>' +
    '<circle cx="12" cy="10.4" r="1.15" fill="' + CFG.color + '"/>' +
    '<circle cx="15.8" cy="10.4" r="1.15" fill="' + CFG.color + '"/>' +
    '</svg>';
  raiz.appendChild(burbuja);

  var panel = document.createElement("div");
  panel.className = "p";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat de " + CFG.empresa);
  raiz.appendChild(panel);

  var cab = document.createElement("div");
  cab.className = "h";
  var caja = document.createElement("div"); caja.className = "t";
  var n = document.createElement("p"); n.className = "n"; n.textContent = CFG.nombre;
  var sub = document.createElement("p"); sub.className = "s"; sub.textContent = CFG.empresa;
  caja.appendChild(n); caja.appendChild(sub);
  var cerrar = document.createElement("button");
  cerrar.className = "x"; cerrar.innerHTML = "&times;";
  cerrar.setAttribute("aria-label", "Cerrar");
  cab.appendChild(caja); cab.appendChild(cerrar);
  panel.appendChild(cab);

  var linea = document.createElement("div"); linea.className = "l";
  panel.appendChild(linea);

  // ── Mini registro ──
  //
  // Va ANTES de dejar escribir. Sin él, la bandeja de Nexus se llenaba
  // de filas idénticas llamadas "Visitante de la web" y no había forma
  // de devolverle la llamada a nadie.
  //
  // Se piden nombre, correo Y TELÉFONO. El teléfono no es un capricho:
  // en este negocio casi todo se cierra llamando, y una consulta de
  // cerramiento sin número obliga a contestar por correo y esperar.
  //
  // La aceptación de la política de datos es obligatoria: son datos
  // personales de alguien que todavía no es cliente.
  //
  // Si la persona ya inició sesión en WordPress, el formulario NO
  // aparece: sus datos vienen en window.COSTAMALLAS_USUARIO (ver la
  // instrucción de instalación) y se entra directo al chat.
  var reg = document.createElement("div");
  reg.className = "g on";
  var regTitulo = document.createElement("h4");
  regTitulo.textContent = "Antes de empezar";
  var regSub = document.createElement("p");
  regSub.className = "sub";
  regSub.textContent =
    "Con sus datos podemos responderle aunque se cierre el chat, " +
    "y su asesor sabe con quién está hablando.";
  reg.appendChild(regTitulo);
  reg.appendChild(regSub);

  var lblN = document.createElement("label"); lblN.textContent = "Su nombre";
  var inpN = document.createElement("input");
  inpN.type = "text"; inpN.maxLength = 80; inpN.autocomplete = "name";
  inpN.placeholder = "María García";
  var lblE = document.createElement("label"); lblE.textContent = "Su correo";
  var inpE = document.createElement("input");
  inpE.type = "email"; inpE.maxLength = 120; inpE.autocomplete = "email";
  inpE.placeholder = "maria@correo.com";
  var lblT = document.createElement("label"); lblT.textContent = "Su celular";
  var inpT = document.createElement("input");
  inpT.type = "tel"; inpT.maxLength = 20; inpT.autocomplete = "tel";
  inpT.placeholder = "300 000 0000";
  reg.appendChild(lblN); reg.appendChild(inpN);
  reg.appendChild(lblE); reg.appendChild(inpE);
  reg.appendChild(lblT); reg.appendChild(inpT);

  var chk = document.createElement("label"); chk.className = "chk";
  var inpC = document.createElement("input"); inpC.type = "checkbox";
  var chkTexto = document.createElement("span");
  chkTexto.appendChild(document.createTextNode("Autorizo el tratamiento de mis datos según la "));
  var enlacePol = document.createElement("a");
  enlacePol.href = CFG.api.replace("/api/public/agente", "") + "/politicas";
  enlacePol.target = "_blank"; enlacePol.rel = "noopener noreferrer";
  enlacePol.textContent = "política de tratamiento de datos";
  chkTexto.appendChild(enlacePol);
  chkTexto.appendChild(document.createTextNode("."));
  chk.appendChild(inpC); chk.appendChild(chkTexto);
  reg.appendChild(chk);

  var btnReg = document.createElement("button");
  btnReg.className = "go"; btnReg.type = "button";
  btnReg.textContent = "Empezar a chatear";
  btnReg.disabled = true;
  reg.appendChild(btnReg);

  var errReg = document.createElement("p");
  errReg.className = "err";
  reg.appendChild(errReg);

  panel.appendChild(reg);

  var lista = document.createElement("div"); lista.className = "m";
  lista.style.display = "none";
  panel.appendChild(lista);

  var pie = document.createElement("form"); pie.className = "f";
  pie.style.display = "none";   // hasta que se complete el registro
  var campo = document.createElement("input");
  campo.type = "text"; campo.placeholder = "Escriba su pregunta…";
  campo.maxLength = 1500; campo.autocomplete = "off";
  campo.setAttribute("aria-label", "Su mensaje");
  var enviar = document.createElement("button");
  enviar.type = "submit"; enviar.textContent = "Enviar";
  pie.appendChild(campo); pie.appendChild(enviar);
  panel.appendChild(pie);

  if (CFG.whatsapp) {
    var wa = document.createElement("a");
    wa.className = "w";
    wa.target = "_blank"; wa.rel = "noopener noreferrer";
    wa.href = "https://wa.me/" + String(CFG.whatsapp).replace(/[^0-9]/g, "");
    wa.textContent = "Prefiero hablar por WhatsApp";
    panel.appendChild(wa);
  }

  function fila(texto, quien) {
    var d = document.createElement("div");
    d.className = "r " + quien;
    var p = document.createElement("p");
    p.textContent = texto;          // NUNCA innerHTML: esto viene de un modelo
    d.appendChild(p);
    lista.appendChild(d);
    lista.scrollTop = lista.scrollHeight;
    return d;
  }

  function puntos() {
    var d = document.createElement("div");
    d.className = "r a";
    var c = document.createElement("div"); c.className = "d";
    c.appendChild(document.createElement("i"));
    c.appendChild(document.createElement("i"));
    c.appendChild(document.createElement("i"));
    d.appendChild(c);
    lista.appendChild(d);
    lista.scrollTop = lista.scrollHeight;
    return d;
  }

  var abierto = false, ocupado = false, saludado = false;
  var visitante = null;   // { nombre, email } una vez registrado

  // Siete dígitos es el mínimo de un fijo nacional; diez, un celular.
  // No se valida más: un formato estricto rechaza números escritos con
  // indicativo, con guiones o con espacios, que es como los escribe todo
  // el mundo.
  function telefonoValido(v) {
    return String(v || "").replace(/\D/g, "").length >= 7;
  }

  function correoValido(v) {
    // Ojo: este archivo emite JavaScript desde un template literal de
    // TypeScript, así que las barras invertidas van DOBLES. Con una
    // sola, \\s llega al navegador como "s" y el validador rechazaría
    // cualquier correo que lleve una ese.
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(v);
  }

  function revisarRegistro() {
    var listo = inpN.value.trim().length >= 2
      && correoValido(inpE.value.trim())
      && telefonoValido(inpT.value)
      && inpC.checked;
    btnReg.disabled = !listo;
    return listo;
  }
  inpN.addEventListener("input", revisarRegistro);
  inpE.addEventListener("input", revisarRegistro);
  inpC.addEventListener("change", revisarRegistro);

  function entrarAlChat() {
    if (!revisarRegistro()) {
      errReg.textContent = !inpC.checked
        ? "Hace falta autorizar el tratamiento de datos para poder atenderle."
        : "Revise el nombre, el correo y el celular.";
      return;
    }
    visitante = {
      nombre: inpN.value.trim(),
      email: inpE.value.trim(),
      telefono: inpT.value.trim(),
    };
    guardarVisitante(visitante);
    mostrarChat();
  }
  btnReg.addEventListener("click", entrarAlChat);
  inpE.addEventListener("keydown", function (e) { if (e.key === "Enter") entrarAlChat(); });

  function mostrarChat() {
    reg.className = "g";
    lista.style.display = "";
    pie.style.display = "";
    if (!saludado) {
      fila(CFG.saludo + (visitante && visitante.nombre ? " Con gusto, " + visitante.nombre.split(" ")[0] + "." : ""), "a");
      saludado = true;
    }
    setTimeout(function () { campo.focus(); }, 60);
  }

  /**
   * Si la persona inició sesión en WordPress, ya sabemos quién es.
   *
   * WordPress no deja leer la sesión desde un script de otro dominio, así
   * que el propio sitio publica los datos en window.COSTAMALLAS_USUARIO
   * cuando hay alguien dentro. El fragmento que hace eso está en
   * Configuración → Agente web, listo para pegar en el functions.php.
   *
   * Si está, el formulario NO aparece: se entra directo al chat y en
   * Nexus la conversación llega ya identificada.
   */
  function usuarioDeWordPress() {
    var u = window.COSTAMALLAS_USUARIO;
    if (!u || typeof u !== "object") return null;
    var nombre = String(u.nombre || u.name || "").trim();
    var email = String(u.email || "").trim();
    if (nombre.length < 2 || !correoValido(email)) return null;
    return {
      nombre: nombre,
      email: email,
      telefono: String(u.telefono || u.phone || "").trim(),
      // Se marca para que en la bandeja se sepa que viene identificado
      // desde la web, no escrito a mano en un formulario.
      wp: true,
    };
  }

  function alternar() {
    abierto = !abierto;
    panel.className = abierto ? "p on" : "p";
    if (abierto) {
      // Orden: la sesión de WordPress manda sobre lo que se guardó antes,
      // porque si hay alguien con sesión iniciada ESE es quien escribe.
      if (!visitante) visitante = usuarioDeWordPress() || leerVisitante();
      if (visitante || token()) { mostrarChat(); }
      else { setTimeout(function () { inpN.focus(); }, 60); }
    }
  }
  burbuja.addEventListener("click", alternar);
  cerrar.addEventListener("click", alternar);

  function token() { try { return sessionStorage.getItem(SS); } catch (e) { return null; } }
  function guardar(t) { try { sessionStorage.setItem(SS, t); } catch (e) {} }
  function leerVisitante() {
    try { return JSON.parse(localStorage.getItem(LSV) || "null"); } catch (e) { return null; }
  }
  function guardarVisitante(v) {
    try { localStorage.setItem(LSV, JSON.stringify(v)); } catch (e) {}
  }

  pie.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var texto = campo.value.trim();
    if (!texto || ocupado) return;

    fila(texto, "y");
    campo.value = "";
    ocupado = true; enviar.disabled = true;
    var esperando = puntos();

    fetch(CFG.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensaje: texto,
        token: token(),
        // Solo sirven en el PRIMER mensaje —después la conversación ya
        // existe— pero se mandan siempre: es más barato que llevar la
        // cuenta de si ya se mandaron.
        nombre: visitante ? visitante.nombre : "",
        email: visitante ? visitante.email : "",
        telefono: visitante ? visitante.telefono : "",
        deWordPress: !!(visitante && visitante.wp),
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        esperando.remove();
        var d = (j && j.data) || {};
        if (d.token) guardar(d.token);
        fila(d.texto || (j && j.error) || "No pude responder en este momento.", "a");
        if (d.escalado) fila("Un asesor va a continuar esta conversación.", "e");
      })
      .catch(function () {
        esperando.remove();
        fila("No se pudo conectar. Intente de nuevo en un momento.", "a");
      })
      .then(function () { ocupado = false; enviar.disabled = false; campo.focus(); });
  });
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // El widget puede pedirlo cualquier página: es un script público.
      "Access-Control-Allow-Origin": "*",
      // Un minuto de caché: cambiar el saludo desde el portal se ve casi
      // enseguida, y aun así no se pide en cada visita.
      "Cache-Control": "public, max-age=60",
    },
  });
}
