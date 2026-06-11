"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  FileInput, FileOutput, Wifi, WifiOff, Loader2, RefreshCw, Download,
  ShoppingCart, ArrowRight, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const WC = "#7c3aed";

function WooContent() {
  const [probando, setProbando] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [importandoPedidos, setImportandoPedidos] = useState(false);

  const probar = async () => {
    setProbando(true);
    try {
      const res = await fetch("/api/woocommerce/test", { method: "POST" });
      const json = await res.json();
      setEstado({ ok: !!json.success, mensaje: json.success ? `Conectado: ${json.data?.storeName ?? "tienda"} (WC ${json.data?.version ?? ""})` : (json.error ?? "Sin conexión") });
    } catch { setEstado({ ok: false, mensaje: "Error de conexión" }); } finally { setProbando(false); }
  };

  const importarPedidos = async () => {
    setImportandoPedidos(true);
    try {
      const res = await fetch("/api/woocommerce/import-orders", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      const d = json.data;
      toast.success(`${d.importados} pedidos · ${d.clientesCreados} clientes nuevos · ${d.omitidos} ya existían`);
    } catch { toast.error("Error"); } finally { setImportandoPedidos(false); }
  };

  return (
    <>
      <Topbar title="Sincronización WooCommerce" actions={
        <button onClick={probar} disabled={probando} className="btn-secondary btn-sm">
          {probando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Probar conexión
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5 max-w-3xl mx-auto w-full">

        {/* Estado de conexión */}
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (estado?.ok ? "#16a34a" : WC) + "18" }}>
            {estado ? (estado.ok ? <Wifi size={22} className="text-emerald-600" /> : <WifiOff size={22} className="text-red-500" />) : <ShoppingCart size={22} style={{ color: WC }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Estado de la conexión</p>
            <p className="text-xs text-muted mt-0.5">{estado ? estado.mensaje : "Pulsa 'Probar conexión' para verificar tu tienda WooCommerce."}</p>
          </div>
          <Link href="/configuracion?tab=woocommerce" className="btn-secondary btn-sm">Configurar</Link>
        </div>

        {/* Acciones principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/importar" className="card card-hover p-5 block">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "#16a34a18" }}><FileInput size={20} className="text-emerald-600" /></div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Importar productos</p>
            <p className="text-xs text-muted mt-1">Trae productos desde tu tienda WooCommerce al catálogo del ERP.</p>
            <span className="text-xs font-semibold mt-3 inline-flex items-center gap-1" style={{ color: WC }}>Ir a importar <ArrowRight size={12} /></span>
          </Link>
          <Link href="/exportar" className="card card-hover p-5 block">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "#185FA518" }}><FileOutput size={20} style={{ color: "#185FA5" }} /></div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Exportar productos</p>
            <p className="text-xs text-muted mt-1">Publica o actualiza tus productos del ERP en WooCommerce.</p>
            <span className="text-xs font-semibold mt-3 inline-flex items-center gap-1" style={{ color: WC }}>Ir a exportar <ArrowRight size={12} /></span>
          </Link>
        </div>

        {/* Importar pedidos */}
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: WC + "18" }}><Download size={20} style={{ color: WC }} /></div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Importar pedidos de la tienda</p>
            <p className="text-xs text-muted mt-0.5">Trae las órdenes de WooCommerce → Pedidos del CRM (identifica/crea el cliente por email o teléfono).</p>
          </div>
          <button onClick={importarPedidos} disabled={importandoPedidos} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: WC }}>
            {importandoPedidos ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Importar
          </button>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-muted">Los errores de validación de productos se muestran en <Link href="/errores" className="font-semibold" style={{ color: WC }}>ERP → Errores</Link>.</p>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><WooContent /></Suspense>; }
