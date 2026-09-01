"use client";

// ============================================================
// La primera pantalla del teléfono: elige módulo.
//
// Antes el portal abría directo en Nexus en el móvil. Funcionaba para
// quien vive contestando, pero a quien entra a mirar el stock le costaba
// dos toques y un susto ("¿y el ERP dónde quedó?"). Ahora la primera
// pantalla es el tablero de módulos: se ve todo lo que la persona puede
// abrir, con lo que tiene pendiente, y entra a lo que venía a hacer.
//
// Tres reglas para que no estorbe:
//
//   1. Solo en el TELÉFONO. En escritorio el menú lateral está siempre
//      a la vista y una pantalla intermedia sería un clic de más.
//   2. Una vez por visita, no una por página. Se recuerda en
//      `sessionStorage`: al cerrar el navegador vuelve a aparecer, pero
//      no cada vez que se navega dentro del portal.
//   3. NUNCA sobre un enlace directo. Si alguien llega desde un correo o
//      una notificación a una cotización concreta, se va a la
//      cotización. Interponer el tablero le borraría el destino.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Package, UserCircle, MessageSquare, Megaphone, ShieldCheck, ArrowRight,
} from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/hooks/useAuth";
import { modulosVisibles, type ModuloClave } from "@/lib/permisos";

type Modulo = "ERP" | "CRM" | "NEXUS" | "MARKETING";

interface Ficha {
  clave: ModuloClave;
  titulo: string;
  que: string;
  href: string;
  Icon: React.ElementType;
  color: string;
}

const FICHAS: Ficha[] = [
  {
    clave: "NEXUS", titulo: "Nexus", href: "/nexus", Icon: MessageSquare, color: "#7c3aed",
    que: "Los mensajes de tus clientes: la web, WhatsApp y el correo en una sola bandeja.",
  },
  {
    clave: "CRM", titulo: "CRM", href: "/crm", Icon: UserCircle, color: "#BA7517",
    que: "Tus clientes, las cotizaciones y en qué va cada negocio.",
  },
  {
    clave: "ERP", titulo: "ERP", href: "/", Icon: Package, color: "#185FA5",
    que: "Catálogo, existencias, pedidos y facturación.",
  },
  {
    clave: "MARKETING", titulo: "Marketing", href: "/marketing", Icon: Megaphone, color: "#db2777",
    que: "Campañas, contenido y lo que se publica.",
  },
  {
    clave: "SISTEMA", titulo: "Sistema", href: "/sistema/salud", Icon: ShieldCheck, color: "#0f766e",
    que: "Salud del portal, reportes y seguridad.",
  },
];

/** Las páginas de entrada de cada módulo. Cualquier otra ruta es un enlace directo. */
const RAICES = new Set(["/", "/crm", "/nexus", "/marketing"]);

const YA_VISTO = "cm_lanzador_visto";

export function LanzadorMovil({ nexusSinLeer = 0 }: { nexusSinLeer?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setMode, brand } = useBrand();
  const { user, permisos, isLoading } = useAuth();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (isLoading || permisos.size === 0) return;
    if (!RAICES.has(pathname)) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    try {
      if (sessionStorage.getItem(YA_VISTO)) return;
    } catch {
      return; // Sin sessionStorage saldría en cada página. Mejor no salir.
    }
    setAbierto(true);
  }, [isLoading, permisos, pathname]);

  if (!abierto) return null;

  const visibles = modulosVisibles(permisos);
  const fichas = FICHAS.filter(f => visibles.includes(f.clave));
  if (fichas.length === 0) return null;

  const entrar = (f: Ficha) => {
    try { sessionStorage.setItem(YA_VISTO, "1"); } catch {}
    if (f.clave !== "SISTEMA") setMode(f.clave as Modulo);
    setAbierto(false);
    router.push(f.href);
  };

  const nombre = (user?.nombre ?? "").split(" ")[0];
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="lg:hidden fixed inset-0 z-[60] page-bg overflow-y-auto">
      <div className="min-h-full flex flex-col px-5 pt-10 pb-8"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>

        <header className="mb-7">
          <p className="text-[13px] text-muted">
            {saludo}{nombre ? `, ${nombre}` : ""}
          </p>
          <h1 className="text-[26px] font-bold leading-tight text-soft mt-1">
            ¿Qué vas a hacer?
          </h1>
          <p className="text-[13px] text-muted mt-2">
            {brand.companyName} · toca un módulo para entrar.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {fichas.map(f => {
            const Icon = f.Icon;
            const pendientes = f.clave === "NEXUS" ? nexusSinLeer : 0;
            return (
              <button
                key={f.clave}
                onClick={() => entrar(f)}
                className="w-full text-left surface border divider rounded-2xl p-4 flex items-start gap-4 active:scale-[.985] transition-transform"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: f.color + "18" }}>
                  <Icon size={22} style={{ color: f.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-soft">{f.titulo}</span>
                    {pendientes > 0 && (
                      <span className="text-[11px] font-bold text-white rounded-full px-2 py-0.5"
                        style={{ backgroundColor: f.color }}>
                        {pendientes > 99 ? "99+" : pendientes} sin leer
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-muted leading-snug mt-1">{f.que}</p>
                </div>

                <ArrowRight size={17} className="text-muted flex-shrink-0 mt-3.5" />
              </button>
            );
          })}
        </div>

        <p className="text-[11.5px] text-muted text-center mt-7 leading-relaxed">
          Después puedes cambiar de módulo desde la barra de abajo.
          Esta pantalla sale una vez por visita.
        </p>
      </div>
    </div>
  );
}
