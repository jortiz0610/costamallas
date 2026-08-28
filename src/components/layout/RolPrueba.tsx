"use client";

// ============================================================
// "Ver el portal como…" — el selector y la barra de aviso.
//
// La barra va ARRIBA DE TODO y es imposible de ignorar a propósito. El
// fallo probable de esta función no es que no funcione: es olvidarse el
// modo puesto, ver que nada se guarda y creer que el portal está roto.
// Por eso la franja es ancha, dice el rol en grande y lleva el botón de
// salir siempre a la vista.
//
// Solo la ve el superadministrador. Para cualquier otro no se pinta
// nada, y aunque se pintara no serviría: el permiso lo da el token, no
// esta pantalla.
// ============================================================

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Eye, X, ChevronDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Rol } from "@/types";

interface Estado {
  puede: boolean;
  rolReal: Rol;
  rolPrueba: Rol | null;
  roles: { rol: Rol; label: string; descripcion: string }[];
}

export function RolPrueba() {
  const qc = useQueryClient();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const { data } = useQuery<Estado>({
    queryKey: ["rol-prueba"],
    queryFn: async () => (await (await fetch("/api/auth/rol-prueba")).json()).data,
    staleTime: 60_000,
  });

  if (!data?.puede) return null;

  const cambiar = async (rol: Rol | null) => {
    setOcupado(true);
    try {
      const res = await fetch("/api/auth/rol-prueba", {
        method: rol ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(rol ? { body: JSON.stringify({ rol }) } : {}),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo cambiar el rol");

      setAbierto(false);
      // Recarga completa: el rol decide qué módulos pinta el menú y qué
      // devuelve cada consulta. Invalidar la caché de react-query no
      // basta — media pantalla se armó con el rol anterior.
      qc.clear();
      router.refresh();
      window.location.href = "/";
    } finally { setOcupado(false); }
  };

  const activo = data.rolPrueba;
  const etiqueta = activo ? (data.roles.find(r => r.rol === activo)?.label ?? activo) : null;

  // ── Con el modo puesto: franja de aviso ──
  if (activo) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0 no-print"
        style={{ backgroundColor: "#7c3aed", color: "#fff" }}
      >
        <Eye size={15} className="flex-shrink-0" />
        <p className="text-xs flex-1 min-w-0">
          Estás viendo el portal como <strong>{etiqueta}</strong>.{" "}
          <span style={{ color: "rgba(255,255,255,.75)" }}>
            Es una prueba: no se guarda ningún cambio.
          </span>
        </p>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setAbierto(v => !v)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: "rgba(255,255,255,.18)" }}
          >
            Cambiar de rol
          </button>
          {abierto && <Lista roles={data.roles} activo={activo} onElegir={cambiar} ocupado={ocupado} />}
        </div>
        <button
          onClick={() => cambiar(null)}
          disabled={ocupado}
          className="text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 flex-shrink-0"
          style={{ backgroundColor: "#fff", color: "#7c3aed" }}
        >
          {ocupado ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Salir
        </button>
      </div>
    );
  }

  // ── Sin el modo puesto: solo el disparador ──
  return (
    <div className="flex justify-end px-4 pt-2 no-print">
      <div className="relative">
        <button
          onClick={() => setAbierto(v => !v)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 surface-2 text-muted hover:text-soft"
          title="Ver el portal como otro rol, sin poder guardar nada"
        >
          <Eye size={12} /> Ver como… <ChevronDown size={11} />
        </button>
        {abierto && <Lista roles={data.roles} activo={null} onElegir={cambiar} ocupado={ocupado} />}
      </div>
    </div>
  );
}

function Lista({ roles, activo, onElegir, ocupado }: {
  roles: Estado["roles"];
  activo: Rol | null;
  onElegir: (rol: Rol) => void;
  ocupado: boolean;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1.5 w-72 rounded-xl overflow-hidden shadow-xl z-50"
      style={{ backgroundColor: "var(--surface-1, #fff)", border: "1px solid var(--border)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-3 pt-3 pb-1">
        Ver el portal como
      </p>
      {roles.map(r => (
        <button
          key={r.rol}
          onClick={() => onElegir(r.rol)}
          disabled={ocupado || r.rol === activo}
          className="w-full text-left px-3 py-2 hover:surface-2 disabled:opacity-45"
        >
          <span className="block text-xs font-semibold text-soft">
            {r.label}{r.rol === activo ? " · puesto ahora" : ""}
          </span>
          <span className="block text-[10.5px] text-muted leading-snug">{r.descripcion}</span>
        </button>
      ))}
      <p className="text-[10px] text-muted px-3 py-2 leading-snug" style={{ borderTop: "1px solid var(--border)" }}>
        Solo para mirar: mientras esté puesto, el portal rechaza cualquier cambio.
        Se quita solo a las 2 horas.
      </p>
    </div>
  );
}
