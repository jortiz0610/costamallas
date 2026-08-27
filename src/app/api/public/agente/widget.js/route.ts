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
  var LS = "costamallas_agente_token";

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
  ].join("");
  raiz.appendChild(estilo);

  var burbuja = document.createElement("button");
  burbuja.className = "b";
  burbuja.setAttribute("aria-label", "Abrir el chat de " + CFG.empresa);
  burbuja.textContent = "💬";
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

  var lista = document.createElement("div"); lista.className = "m";
  panel.appendChild(lista);

  var pie = document.createElement("form"); pie.className = "f";
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

  function alternar() {
    abierto = !abierto;
    panel.className = abierto ? "p on" : "p";
    if (abierto) {
      if (!saludado) { fila(CFG.saludo, "a"); saludado = true; }
      setTimeout(function () { campo.focus(); }, 60);
    }
  }
  burbuja.addEventListener("click", alternar);
  cerrar.addEventListener("click", alternar);

  function token() { try { return localStorage.getItem(LS); } catch (e) { return null; } }
  function guardar(t) { try { localStorage.setItem(LS, t); } catch (e) {} }

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
      body: JSON.stringify({ mensaje: texto, token: token() }),
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
