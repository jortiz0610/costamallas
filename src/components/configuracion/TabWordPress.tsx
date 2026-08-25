"use client";

// ============================================================
// Conexión con WordPress.
//
// Esta pestaña existía como maqueta: el formulario estaba pintado pero
// desactivado, con un aviso de "próximamente". El backend en cambio ya
// estaba entero (`/api/wordpress/test` prueba y guarda), así que lo único
// que faltaba era esto.
//
// No es un lujo. Sin WordPress conectado, las imágenes y las fichas
// técnicas que se suben desde el portal se van por FTP a una carpeta que
// hoy NADIE sirve: el archivo queda en el servidor y la URL da 404. Es la
// razón de que "la ficha técnica se sube pero no se ve en la página".
//
// Con WordPress conectado, todo eso se guarda en la biblioteca de medios
// del sitio, que es donde ya viven las imágenes que sí funcionan.
// ============================================================

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Globe, Loader2, Check, X, AlertTriangle, ExternalLink, Eye, EyeOff, Plug,
} from "lucide-react";
import toast from "react-hot-toast";

interface Estado {
  configured: boolean;
  ok?: boolean;
  user?: string;
  siteUrl?: string;
  error?: string;
}

export function TabWordPress() {
  const [siteUrl, setSiteUrl] = useState("https://costamallas.com");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [probando, setProbando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ data: Estado }>({
    queryKey: ["wp-estado"],
    queryFn: async () => (await (await fetch("/api/wordpress/test")).json()),
  });

  useEffect(() => {
    if (data?.data?.siteUrl) setSiteUrl(data.data.siteUrl);
  }, [data]);

  const enviar = async (guardar: boolean) => {
    if (!usuario.trim() || !clave.trim()) {
      return toast.error("Escribe el usuario y la contraseña de aplicación");
    }
    guardar ? setGuardando(true) : setProbando(true);
    try {
      const res = await fetch("/api/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // La contraseña de aplicación se muestra con espacios; WordPress
        // los ignora, así que se manda tal cual la copió el usuario.
        body: JSON.stringify({ siteUrl: siteUrl.trim(), user: usuario.trim(), appPassword: clave, guardar }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo conectar");

      if (guardar) {
        toast.success(`Conectado como ${j.data.user}. Ya se puede guardar en la biblioteca de WordPress.`);
        setClave("");
      } else {
        toast.success(`Conexión correcta: ${j.data.user}`);
      }
      refetch();
    } finally { setProbando(false); setGuardando(false); }
  };

  const estado = data?.data;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: "#21759b" }}>
          <Globe size={24} />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Conexión con WordPress</h2>
          <p className="text-xs text-muted mt-0.5">
            Donde se guardan las imágenes y las fichas técnicas que subes desde el portal.
          </p>
        </div>
      </div>

      {/* Estado */}
      {isLoading ? (
        <div className="card p-6 text-center"><Loader2 size={16} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>
      ) : !estado?.configured ? (
        <div className="card p-4 flex items-start gap-2.5" style={{ borderLeft: "4px solid #f59e0b" }}>
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-soft">Sin conectar</p>
            <p className="text-muted mt-1 leading-relaxed">
              Mientras no esté conectado, lo que subas desde el portal se va por FTP a una carpeta que hoy no
              sirve ninguna página: el archivo queda guardado pero su dirección da error. Es el motivo de que
              la ficha técnica se suba y no aparezca en la web.
            </p>
          </div>
        </div>
      ) : estado.ok ? (
        <div className="card p-4 flex items-start gap-2.5" style={{ borderLeft: "4px solid #16a34a" }}>
          <Check size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-soft">Conectado como {estado.user}</p>
            <p className="text-muted mt-0.5">{estado.siteUrl}</p>
          </div>
        </div>
      ) : (
        <div className="card p-4 flex items-start gap-2.5" style={{ borderLeft: "4px solid #dc2626" }}>
          <X size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-soft">Guardado, pero no conecta</p>
            <p className="text-muted mt-1 break-words">{estado.error}</p>
          </div>
        </div>
      )}

      {/* Formulario */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Dirección del sitio</label>
          <input className="input" type="url" value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
            placeholder="https://costamallas.com" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Usuario de WordPress</label>
          <input className="input" value={usuario} onChange={e => setUsuario(e.target.value)}
            placeholder="El nombre de usuario con el que entras a wp-admin" autoComplete="off" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Contraseña de aplicación</label>
          <div className="relative">
            <input
              className="input font-mono text-xs pr-10"
              type={verClave ? "text" : "password"}
              value={clave}
              onChange={e => setClave(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setVerClave(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
              {verClave ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            No es la contraseña con la que entras a WordPress. Es una clave aparte, de 24 caracteres con espacios,
            que se puede revocar sin cambiar la tuya.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={() => enviar(false)} disabled={probando || guardando} className="btn-secondary flex-1 justify-center">
            {probando ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Probar
          </button>
          <button onClick={() => enviar(true)} disabled={probando || guardando} className="btn-primary flex-1 justify-center">
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar y conectar
          </button>
        </div>
        <p className="text-[11px] text-muted">
          La contraseña se guarda cifrada (AES-256). <b>Cárgala desde el portal en producción</b>: lo que se cifra
          en un computador local no se puede descifrar en el servidor, porque la clave de cifrado es distinta.
        </p>
      </div>

      {/* Cómo sacar la clave */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Cómo se saca la contraseña de aplicación</p>
        <ol className="space-y-2">
          {[
            <>Entra a <code className="surface-3 px-1 rounded">costamallas.com/wp-admin</code></>,
            <>Ve a <b>Usuarios → Perfil</b> (el tuyo)</>,
            <>Baja hasta <b>Contraseñas de aplicación</b></>,
            <>Escribe un nombre, por ejemplo <code className="surface-3 px-1 rounded">Portal ERP</code>, y pulsa <b>Añadir</b></>,
            <>Copia la clave que aparece. <b>Solo se muestra una vez</b>: si la pierdes, se borra esa y se crea otra.</>,
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-soft">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "#21759b" }}>{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <a href="https://costamallas.com/wp-admin/profile.php" target="_blank" rel="noreferrer"
          className="btn-secondary btn-sm mt-4 inline-flex">
          <ExternalLink size={13} /> Abrir mi perfil de WordPress
        </a>
      </div>

      {/* Qué se desbloquea */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Qué queda funcionando al conectarlo</p>
        <ul className="space-y-2">
          {[
            "Las imágenes de producto que subas desde el portal quedan en la biblioteca del sitio y se ven en la tienda",
            "Las fichas técnicas en PDF dejan de perderse: hoy se suben a una carpeta que nadie publica",
            "Las fotos de obra de las instalaciones —la evidencia ante un reclamo— quedan accesibles de verdad",
            "El logo de la empresa se puede cargar y sale en la portada de la propuesta",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted">
              <Check size={12} className="mt-0.5 flex-shrink-0 text-emerald-500" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
