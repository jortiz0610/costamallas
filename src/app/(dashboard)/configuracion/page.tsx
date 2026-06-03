"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Settings, Link2, Check, X, Loader2, Eye, EyeOff, Building2, Palette, Upload, ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useBrand } from "@/contexts/BrandContext";

interface WCStatus { configured: boolean; ok?: boolean; storeName?: string; version?: string; error?: string; }

async function fetchWCStatus(): Promise<WCStatus> {
  const res = await fetch("/api/woocommerce/test");
  if (!res.ok) return { configured: false };
  return (await res.json()).data;
}

function TabEmpresa() {
  const { brand, setBrand } = useBrand();
  const [form, setForm] = useState({
    companyName: brand.companyName, legalName: brand.legalName,
    nit: brand.nit, address: brand.address, phone: brand.phone,
    email: brand.email, brandColor: brand.brandColor,
  });
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logoUrl);
  const [icoPreview, setIcoPreview] = useState<string | null>(brand.icoUrl);
  const logoRef = useRef<HTMLInputElement>(null);
  const icoRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "ico") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      if (type === "logo") setLogoPreview(result);
      else setIcoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/configuracion/empresa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_nombre: form.companyName, empresa_legal: form.legalName,
          empresa_nit: form.nit, empresa_direccion: form.address,
          empresa_telefono: form.phone, empresa_email: form.email,
          empresa_color: form.brandColor,
          empresa_logo: logoPreview ?? "", empresa_ico: icoPreview ?? "",
        }),
      });
      setBrand({ companyName: form.companyName, legalName: form.legalName, nit: form.nit, address: form.address, phone: form.phone, email: form.email, brandColor: form.brandColor, logoUrl: logoPreview, icoUrl: icoPreview });
      toast.success("Configuracion guardada");
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Building2 size={14} style={{ color: form.brandColor }} /> Informacion de la empresa
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nombre comercial *</label>
            <input className="input" value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} placeholder="Ej: Mi Empresa" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Razon social (legal)</label>
            <input className="input" value={form.legalName} onChange={e => setForm(p => ({ ...p, legalName: e.target.value }))} placeholder="Ej: Mi Empresa S.A.S." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">NIT / RUT</label>
            <input className="input" value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} placeholder="900.000.000-0" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Telefono</label>
            <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="601 000 0000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email corporativo</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="info@empresa.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Direccion</label>
            <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Calle 123, Bogota" />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Palette size={14} style={{ color: form.brandColor }} /> Color corporativo
        </h2>
        <p className="text-xs text-gray-400">Cambia botones, accentos y elementos activos del sistema.</p>
        <div className="flex items-center gap-4">
          <input type="color" value={form.brandColor} onChange={e => setForm(p => ({ ...p, brandColor: e.target.value }))}
            className="w-12 h-12 rounded-xl cursor-pointer border-2 border-gray-200 dark:border-gray-700 p-0.5 bg-white dark:bg-gray-800" />
          <input type="text" value={form.brandColor} onChange={e => setForm(p => ({ ...p, brandColor: e.target.value }))}
            className="input flex-1 font-mono text-sm" placeholder="#6366f1" maxLength={7} />
          <div className="flex gap-2">
            {["#185FA5","#BA7517","#7c3aed","#16a34a","#dc2626","#0891b2"].map(c => (
              <button key={c} onClick={() => setForm(p => ({ ...p, brandColor: c }))}
                className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform"
                style={{ backgroundColor: c, borderColor: form.brandColor === c ? c : "transparent" }} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: form.brandColor + "15" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: form.brandColor }}>
            {form.companyName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold" style={{ color: form.brandColor }}>{form.companyName || "Mi Empresa"}</p>
            <p className="text-[10px] text-gray-400">Vista previa del color</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: form.brandColor }}>Ejemplo</button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <ImageIcon size={14} style={{ color: form.brandColor }} /> Identidad visual
        </h2>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Logo principal *</label>
            <div onClick={() => logoRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-300 transition-colors"
              style={logoPreview ? {} : { borderColor: form.brandColor + "60" }}>
              {logoPreview ? (
                <div className="relative w-full">
                  <img src={logoPreview} alt="Logo" className="h-16 object-contain mx-auto" />
                  <button onClick={e => { e.stopPropagation(); setLogoPreview(null); }}
                    className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X size={10} /></button>
                </div>
              ) : (
                <><Upload size={16} className="text-gray-300" /><p className="text-xs text-gray-400 text-center">PNG, SVG recomendado</p></>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "logo")} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Favicon <span className="text-gray-300 normal-case font-normal">(opcional)</span></label>
            <div onClick={() => icoRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-300 transition-colors">
              {icoPreview ? (
                <div className="relative">
                  <img src={icoPreview} alt="ICO" className="h-16 w-16 object-contain mx-auto" />
                  <button onClick={e => { e.stopPropagation(); setIcoPreview(null); }}
                    className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X size={10} /></button>
                </div>
              ) : (
                <><ImageIcon size={16} className="text-gray-200" /><p className="text-xs text-gray-400 text-center">Si no subes, usa el logo</p></>
              )}
            </div>
            <input ref={icoRef} type="file" accept="image/*,.ico" className="hidden" onChange={e => handleFile(e, "ico")} />
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full justify-center">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Guardar configuracion de empresa
      </button>
    </div>
  );
}

function TabWooCommerce() {
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const { data: wcStatus, isLoading, refetch } = useQuery({ queryKey: ["wc","status"], queryFn: fetchWCStatus });
  const testMutation = useMutation({
    mutationFn: async (guardar: boolean) => {
      const res = await fetch("/api/woocommerce/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeUrl, consumerKey, consumerSecret, guardar }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Error");
      return json.data;
    },
    onSuccess: (data, guardar) => {
      toast.success(`Conexion exitosa - ${data.storeName} (WC ${data.version})`);
      if (guardar) { toast.success("Credenciales guardadas"); refetch(); }
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Link2 size={14} className="text-blue-500" />Estado de conexion</h2>
        {isLoading ? <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={13} className="animate-spin" />Verificando...</div>
        : wcStatus?.configured && wcStatus.ok ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <Check size={15} className="text-green-600" />
            <div><p className="text-[13px] font-medium text-green-800 dark:text-green-300">Conectado</p><p className="text-[11px] text-green-600 dark:text-green-400">{wcStatus.storeName} - WC {wcStatus.version}</p></div>
          </div>
        ) : wcStatus?.configured && !wcStatus.ok ? (
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <X size={15} className="text-red-600" />
            <div><p className="text-[13px] font-medium text-red-800 dark:text-red-300">Error de conexion</p><p className="text-[11px] text-red-600 dark:text-red-400">{wcStatus.error ?? "Verifica credenciales"}</p></div>
          </div>
        ) : <p className="text-xs text-gray-500 dark:text-gray-400">No configurado. Ingresa tus credenciales.</p>}
      </div>
      <div className="card p-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Settings size={14} />Credenciales WooCommerce</h2>
        <p className="text-[11px] text-gray-400">Claves cifradas AES-256-GCM. Obtenlas en WordPress: WooCommerce - Configuracion - Avanzado - REST API.</p>
        <div><label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">URL de la tienda</label><input value={storeUrl} onChange={e => setStoreUrl(e.target.value)} className="input" placeholder="https://tutienda.com" type="url" /></div>
        <div><label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Consumer Key</label>
          <div className="relative"><input value={consumerKey} onChange={e => setConsumerKey(e.target.value)} className="input pr-10 font-mono text-[12px]" placeholder="ck_..." type={showKey ? "text" : "password"} />
            <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
        </div>
        <div><label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Consumer Secret</label>
          <div className="relative"><input value={consumerSecret} onChange={e => setConsumerSecret(e.target.value)} className="input pr-10 font-mono text-[12px]" placeholder="cs_..." type={showSecret ? "text" : "password"} />
            <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showSecret ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => testMutation.mutate(false)} disabled={!storeUrl || !consumerKey || !consumerSecret || testMutation.isPending} className="btn-secondary">
            {testMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Probar
          </button>
          <button onClick={() => testMutation.mutate(true)} disabled={!storeUrl || !consumerKey || !consumerSecret || testMutation.isPending} className="btn-primary">Guardar y conectar</button>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "woocommerce", label: "WooCommerce", icon: Link2 },
];

export default function ConfiguracionPage() {
  const [tab, setTab] = useState("empresa");
  const { brand } = useBrand();
  return (
    <>
      <Topbar title="Configuracion" />
      <div className="flex-1 overflow-y-auto page-bg">
        <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6">
          <div className="flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-all"
                  style={active ? { borderBottomColor: brand.brandColor, color: brand.brandColor } : { borderBottomColor: "transparent", color: "#6b7280" }}>
                  <Icon size={14} />{t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-6">
          {tab === "empresa" && <TabEmpresa />}
          {tab === "woocommerce" && <TabWooCommerce />}
        </div>
      </div>
    </>
  );
}
