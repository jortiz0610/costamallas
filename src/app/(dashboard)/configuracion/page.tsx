"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Settings, Link2, Check, X, Loader2, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

interface WCStatus {
  configured: boolean;
  ok?: boolean;
  storeName?: string;
  version?: string;
  error?: string;
}

async function fetchWCStatus(): Promise<WCStatus> {
  const res = await fetch("/api/woocommerce/test");
  if (!res.ok) return { configured: false };
  return (await res.json()).data;
}

export default function ConfiguracionPage() {
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: wcStatus, isLoading, refetch } = useQuery({
    queryKey: ["wc", "status"],
    queryFn: fetchWCStatus,
  });

  const testMutation = useMutation({
    mutationFn: async (guardar: boolean) => {
      const res = await fetch("/api/woocommerce/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeUrl, consumerKey, consumerSecret, guardar }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Error de conexión");
      return json.data;
    },
    onSuccess: (data, guardar) => {
      toast.success(`Conexión exitosa — ${data.storeName} (WC ${data.version})`);
      if (guardar) {
        toast.success("Credenciales guardadas de forma segura");
        refetch();
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <Topbar title="Configuración" />
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl space-y-6">

        {/* Estado WooCommerce */}
        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Link2 size={15} /> Conexión WooCommerce
          </h2>

          {isLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Verificando…
            </div>
          ) : wcStatus?.configured && wcStatus.ok ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Check size={16} className="text-green-600" />
              <div>
                <p className="text-[13px] font-medium text-green-800">Conectado</p>
                <p className="text-[11px] text-green-600">{wcStatus.storeName} · WC {wcStatus.version}</p>
              </div>
            </div>
          ) : wcStatus?.configured && !wcStatus.ok ? (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <X size={16} className="text-red-600" />
              <div>
                <p className="text-[13px] font-medium text-red-800">Error de conexión</p>
                <p className="text-[11px] text-red-600">{wcStatus.error ?? "Verifica las credenciales"}</p>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-gray-500">No configurado. Ingresa tus credenciales de WooCommerce abajo.</p>
          )}
        </div>

        {/* Formulario credenciales */}
        <div className="card p-5 space-y-4">
          <h2 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
            <Settings size={15} /> Credenciales WooCommerce
          </h2>
          <p className="text-[11px] text-gray-500">
            Las claves se almacenan cifradas con AES-256-GCM. Obtén las claves en tu admin de WordPress: WooCommerce → Configuración → Avanzado → REST API.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL de la tienda</label>
            <input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              className="input"
              placeholder="https://costamallas.com"
              type="url"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Consumer Key</label>
            <div className="relative">
              <input
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                className="input pr-10 font-mono text-[12px]"
                placeholder="ck_xxxxxxxxxxxxxxxxxxxx"
                type={showKey ? "text" : "password"}
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Consumer Secret</label>
            <div className="relative">
              <input
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                className="input pr-10 font-mono text-[12px]"
                placeholder="cs_xxxxxxxxxxxxxxxxxxxx"
                type={showSecret ? "text" : "password"}
              />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => testMutation.mutate(false)}
              disabled={!storeUrl || !consumerKey || !consumerSecret || testMutation.isPending}
              className="btn-secondary"
            >
              {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Probar conexión
            </button>
            <button
              onClick={() => testMutation.mutate(true)}
              disabled={!storeUrl || !consumerKey || !consumerSecret || testMutation.isPending}
              className="btn-primary"
            >
              Guardar y conectar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
