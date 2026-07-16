"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Settings, Link2, Check, X, Loader2, Eye, EyeOff, Building2, Palette, Upload, ImageIcon,
  ShoppingBag, Store, Users, Globe, Smartphone, Instagram, Facebook, Mail, MessageSquare,
  Plus, PlugZap, ChevronDown, BookOpen, Radio, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { useBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/hooks/useAuth";

interface WCStatus { configured: boolean; ok?: boolean; storeName?: string; version?: string; error?: string; }

async function fetchWCStatus(): Promise<WCStatus> {
  const res = await fetch("/api/woocommerce/test");
  if (!res.ok) return { configured: false };
  return (await res.json()).data;
}

function TabEmpresa() {
  const { brand, setBrand } = useBrand();
  const { user } = useAuth();
  // La información de la empresa es una sola para todos; solo administradores la modifican
  const puedeEditar = user?.rol === "ADMIN" || user?.rol === "SUPERADMIN";
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

  // En modo lectura, reflejar siempre lo que llegue de la BD (el form no se edita)
  useEffect(() => {
    if (puedeEditar) return;
    setForm({ companyName: brand.companyName, legalName: brand.legalName, nit: brand.nit, address: brand.address, phone: brand.phone, email: brand.email, brandColor: brand.brandColor });
    setLogoPreview(brand.logoUrl);
    setIcoPreview(brand.icoUrl);
  }, [brand, puedeEditar]);

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
      const res = await fetch("/api/configuracion/empresa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_nombre: form.companyName, empresa_legal: form.legalName,
          empresa_nit: form.nit, empresa_direccion: form.address,
          empresa_telefono: form.phone, empresa_email: form.email,
          empresa_color: form.brandColor,
          empresa_logo: logoPreview ?? "", empresa_ico: icoPreview ?? "",
        }),
      });
      const json = await res.json().catch(() => ({ success: false }));
      // Solo aplicar localmente si la BD aceptó el cambio — si no, cada usuario vería datos distintos
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo guardar en la base de datos");
        return;
      }
      setBrand({ companyName: form.companyName, legalName: form.legalName, nit: form.nit, address: form.address, phone: form.phone, email: form.email, brandColor: form.brandColor, logoUrl: logoPreview, icoUrl: icoPreview });
      toast.success("Configuracion guardada");
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {!puedeEditar && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
          <Settings size={13} className="flex-shrink-0" />
          Esta información es la misma para toda la empresa y solo un administrador puede modificarla. La ves en modo lectura.
        </div>
      )}
      <fieldset disabled={!puedeEditar} className="space-y-5 border-0 p-0 m-0 min-w-0">
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
            <div onClick={() => puedeEditar && logoRef.current?.click()}
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
            <div onClick={() => puedeEditar && icoRef.current?.click()}
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

      {puedeEditar && (
        <button onClick={save} disabled={saving} className="btn-primary w-full justify-center">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Guardar configuracion de empresa
        </button>
      )}
      </fieldset>
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

function TabMarketplace({ nombre, color, logoChar, descripcion, camposExtra }: {
  nombre: string; color: string; logoChar: string; descripcion: string;
  camposExtra?: { key: string; label: string; placeholder: string; type?: string }[];
}) {
  const [apiKey, setApiKey] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }, 800);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black"
            style={{ backgroundColor: color }}>
            {logoChar}
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{nombre}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{descripcion}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Próximamente
          </div>
        </div>

        <div className="space-y-4 opacity-60 pointer-events-none select-none">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">API Key / Client ID</label>
            <div className="relative">
              <input type={show ? "text" : "password"} className="input font-mono text-xs pr-10" value={apiKey}
                onChange={e => setApiKey(e.target.value)} placeholder="Ingresa tu API key..." />
              <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {(camposExtra ?? []).map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{f.label}</label>
              <input type={f.type ?? "text"} className="input" value={sellerId}
                onChange={e => setSellerId(e.target.value)} placeholder={f.placeholder} />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button disabled className="btn-secondary opacity-50">
              <Check size={13} /> Probar conexión
            </button>
            <button onClick={handleSave} disabled={saving || saved} className="btn-primary">
              {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
              {saved ? "Guardado" : "Guardar configuración"}
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
          <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">
            La integración con {nombre} estará disponible próximamente. Una vez activa, los pedidos y clientes se sincronizarán automáticamente con el CRM.
          </p>
        </div>
      </div>
    </div>
  );
}

function TabWordPressUsers() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: "#21759b" }}>
            <Globe size={24} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">Usuarios de WordPress</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sincroniza compradores del sitio web con el CRM</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">Cómo funciona la identificación automática</p>
            <ul className="space-y-2">
              {[
                "Cuando un usuario hace un pedido en WordPress, su email se busca en el CRM",
                "Si el teléfono o email coincide con un cliente existente, se vincula automáticamente",
                "Las compras aparecen en el perfil del cliente en el módulo CRM",
                "Si es nuevo, se crea el perfil automáticamente como 'Cliente activo'",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check size={12} className="mt-0.5 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="opacity-60 space-y-4 pointer-events-none select-none">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">URL de WordPress</label>
              <input className="input" placeholder="https://tutienda.com" type="url" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Application Password</label>
              <input className="input font-mono text-xs" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" type="password" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
            <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">
              Esta integración estará disponible próximamente. Usa las credenciales de WooCommerce ya configuradas para acceder a los datos de compradores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab de Canales / Conexiones (Nexus + redes) ──
interface NexusConexion { id: string; canal: string; nombre: string; activo: boolean; webhookUrl?: string; }

const CANALES_DEF = [
  {
    value: "wordpress_form", label: "WordPress Forms", Icon: Globe, color: "#21759b", ready: true,
    desc: "Recibe mensajes de los formularios de contacto de tu sitio web.",
    campos: [{ k: "webhook", l: "URL del webhook (se genera al conectar)", ph: "Se genera automáticamente" }],
    guia: [
      "Instala el plugin de webhooks en WordPress (ej: WP Webhooks o CF7 to Webhook).",
      "Crea la conexión aquí abajo para generar tu URL de webhook única.",
      "Pega esa URL en el plugin como destino del formulario.",
      "Los envíos del formulario llegarán automáticamente al inbox de Nexus.",
    ],
  },
  {
    value: "whatsapp", label: "WhatsApp Business", Icon: Smartphone, color: "#25d366", ready: true,
    desc: "Conecta tu número de WhatsApp Business para chatear desde Nexus.",
    campos: [
      { k: "phoneId", l: "Phone Number ID", ph: "Ej: 123456789012345" },
      { k: "token", l: "Token de acceso (Meta)", ph: "EAAG...", secret: true },
    ],
    guia: [
      "Crea una app en Meta for Developers (developers.facebook.com).",
      "Agrega el producto 'WhatsApp' y obtén tu Phone Number ID.",
      "Genera un token de acceso permanente del sistema.",
      "Pega el Phone Number ID y el token aquí, luego conecta.",
    ],
  },
  {
    value: "instagram", label: "Instagram Direct", Icon: Instagram, color: "#e1306c", ready: true,
    desc: "Responde mensajes directos de Instagram desde el inbox.",
    campos: [
      { k: "pageId", l: "Instagram Business Account ID", ph: "Ej: 178414...", },
      { k: "token", l: "Token de página (Meta)", ph: "EAAG...", secret: true },
    ],
    guia: [
      "Vincula tu cuenta de Instagram a una página de Facebook.",
      "En Meta for Developers agrega el producto 'Instagram Graph API'.",
      "Concede permisos de mensajería y genera el token de página.",
      "Pega el ID de la cuenta y el token, luego conecta.",
    ],
  },
  {
    value: "facebook", label: "Facebook Messenger", Icon: Facebook, color: "#1877f2", ready: true,
    desc: "Centraliza los mensajes de tu página de Facebook.",
    campos: [
      { k: "pageId", l: "Facebook Page ID", ph: "Ej: 102938..." },
      { k: "token", l: "Token de página", ph: "EAAG...", secret: true },
    ],
    guia: [
      "En Meta for Developers agrega el producto 'Messenger'.",
      "Selecciona tu página y genera el token de página.",
      "Suscribe la página a los eventos de mensajes.",
      "Pega el Page ID y el token aquí, luego conecta.",
    ],
  },
  {
    value: "email", label: "Email / IMAP", Icon: Mail, color: "#6366f1", ready: true,
    desc: "Convierte tu bandeja de correo en conversaciones de Nexus.",
    campos: [
      { k: "host", l: "Servidor IMAP", ph: "imap.gmail.com" },
      { k: "user", l: "Correo", ph: "ventas@costamallas.com" },
      { k: "pass", l: "Contraseña de aplicación", ph: "••••••••", secret: true },
    ],
    guia: [
      "Activa IMAP en tu proveedor de correo (Gmail, Outlook, etc.).",
      "Genera una 'contraseña de aplicación' (no uses tu contraseña normal).",
      "Ingresa el servidor IMAP, el correo y la contraseña de aplicación.",
      "Conecta y los correos entrantes aparecerán en el inbox.",
    ],
  },
  {
    value: "tiktok", label: "TikTok", Icon: MessageSquare, color: "#111827", ready: false,
    desc: "Mensajes y comentarios de TikTok (próximamente).",
    campos: [],
    guia: ["Integración en desarrollo. Estará disponible en una próxima versión."],
  },
];

function ChannelCard({ canal, conexiones, onConnect, onToggle, brandColor }: {
  canal: typeof CANALES_DEF[number];
  conexiones: NexusConexion[];
  onConnect: (canal: string, nombre: string) => Promise<void>;
  onToggle: (id: string, activo: boolean) => void;
  brandColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const { Icon } = canal;
  const activa = conexiones.find(c => c.canal === canal.value && c.activo);

  const connect = async () => {
    if (!nombre.trim()) return toast.error("Dale un nombre a la conexión");
    setSaving(true);
    await onConnect(canal.value, nombre.trim());
    setSaving(false); setNombre(""); setOpen(false);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: canal.color + "18" }}>
          <Icon size={22} style={{ color: canal.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{canal.label}</p>
            {activa ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Conectado
              </span>
            ) : !canal.ready ? (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">Próximamente</span>
            ) : null}
          </div>
          <p className="text-xs text-muted mt-0.5">{canal.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {activa ? (
            <button onClick={() => onToggle(activa.id, activa.activo)}
              className="w-10 h-5 rounded-full relative transition-all" style={{ backgroundColor: "#16a34a" }}>
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow" />
            </button>
          ) : canal.ready ? (
            <button onClick={() => setOpen(v => !v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: brandColor }}>
              <Plus size={12} /> Conectar
            </button>
          ) : null}
        </div>
      </div>

      {/* Formulario de conexión */}
      {open && canal.ready && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t divider animate-fade-up">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre de la conexión</label>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder={`Ej: ${canal.label} principal`} />
          </div>
          {canal.campos.filter(c => c.k !== "webhook").map(c => (
            <div key={c.k}>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{c.l}</label>
              <input className="input font-mono text-xs" type={(c as { secret?: boolean }).secret ? "password" : "text"} placeholder={c.ph} />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={connect} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />} Conectar canal
            </button>
            <button onClick={() => setShowGuia(v => !v)} className="btn-secondary">
              <BookOpen size={13} /> Guía
            </button>
          </div>
        </div>
      )}

      {/* Guía de conexión */}
      <button onClick={() => setShowGuia(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 border-t divider text-xs font-semibold text-muted hover:text-soft transition-colors">
        <span className="flex items-center gap-1.5"><BookOpen size={12} /> Cómo conectar {canal.label}</span>
        <ChevronDown size={13} className={showGuia ? "rotate-180" : ""} />
      </button>
      {showGuia && (
        <div className="px-4 pb-4 surface-2 animate-fade-up">
          <ol className="space-y-2 pt-3">
            {canal.guia.map((paso, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-soft">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: canal.color }}>{i + 1}</span>
                {paso}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function TabCanales() {
  const { brand } = useBrand();
  const qc = useQueryClient();

  const { data: conexiones = [] } = useQuery<NexusConexion[]>({
    queryKey: ["nexus-conexiones"],
    queryFn: async () => (await (await fetch("/api/nexus/conexiones")).json()).data ?? [],
  });

  const onConnect = async (canal: string, nombre: string) => {
    const res = await fetch("/api/nexus/conexiones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ canal, nombre }) });
    const json = await res.json();
    if (json.success) { toast.success(`${nombre} conectado`); qc.invalidateQueries({ queryKey: ["nexus-conexiones"] }); }
    else toast.error(json.error ?? "Error");
  };

  const onToggle = async (id: string, activo: boolean) => {
    await fetch("/api/nexus/conexiones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, activo: !activo }) });
    qc.invalidateQueries({ queryKey: ["nexus-conexiones"] });
  };

  const activos = conexiones.filter(c => c.activo).length;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${brand.brandColor}10, transparent)` }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brand.brandColor }}>
          <Radio size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Canales y redes sociales</h2>
          <p className="text-xs text-muted mt-0.5">Conecta todos tus canales de comunicación. Los mensajes llegarán al inbox de Nexus y los contactos se guardarán automáticamente en el CRM.</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-xl flex-shrink-0" style={{ backgroundColor: brand.brandColor + "18", color: brand.brandColor }}>{activos} activos</span>
      </div>

      <div className="space-y-3">
        {CANALES_DEF.map(canal => (
          <ChannelCard key={canal.value} canal={canal} conexiones={conexiones} onConnect={onConnect} onToggle={onToggle} brandColor={brand.brandColor} />
        ))}
      </div>
    </div>
  );
}

interface ConexionAds { plataforma: string; clientId: string; hasSecret: boolean; accountId: string; conectado: boolean; }
const PLAT_META: Record<string, { nombre: string; color: string; docs: string }> = {
  google: { nombre: "Google Ads", color: "#4285F4", docs: "https://developers.google.com/google-ads/api/docs/oauth/cloud-project" },
  meta: { nombre: "Meta Ads (Facebook/Instagram)", color: "#1877F2", docs: "https://developers.facebook.com/docs/marketing-api/get-started" },
  tiktok: { nombre: "TikTok Ads", color: "#111827", docs: "https://business-api.tiktok.com/portal/docs" },
};

function PlataformaCard({ conn, onSaved }: { conn: ConexionAds; onSaved: () => void }) {
  const meta = PLAT_META[conn.plataforma];
  const [clientId, setClientId] = useState(conn.clientId);
  const [secret, setSecret] = useState("");
  const [accountId, setAccountId] = useState(conn.accountId);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const guardar = async () => {
    if (!clientId.trim()) return toast.error("Ingresa el Client ID");
    setSaving(true);
    const res = await fetch("/api/marketing/conexiones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plataforma: conn.plataforma, clientId, secret: secret || undefined, accountId }) });
    setSaving(false);
    if ((await res.json()).success) { toast.success("Credenciales guardadas"); setSecret(""); onSaved(); }
    else toast.error("Error al guardar");
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0" style={{ backgroundColor: meta.color }}>{meta.nombre.charAt(0)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{meta.nombre}</p>
          <p className="text-xs text-muted">{conn.hasSecret ? "Credenciales guardadas" : "Sin configurar"}</p>
        </div>
        {conn.conectado ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 rounded-lg"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Conectado</span>
        ) : conn.hasSecret ? (
          <a href={`/api/marketing/oauth/${conn.plataforma}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: meta.color }}>Conectar cuenta</a>
        ) : (
          <button onClick={() => setOpen(v => !v)} className="btn-secondary btn-sm">Configurar</button>
        )}
        <button onClick={() => setOpen(v => !v)} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><ChevronDown size={14} className={open ? "rotate-180" : ""} /></button>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t divider pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Client / App ID</label>
              <input className="input font-mono text-xs" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="123456789..." />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Account ID (opcional)</label>
              <input className="input font-mono text-xs" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="act_..." />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Client Secret {conn.hasSecret && <span className="text-emerald-500 normal-case">(guardado — déjalo vacío para no cambiar)</span>}</label>
            <input type="password" className="input font-mono text-xs" value={secret} onChange={e => setSecret(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="flex items-center justify-between">
            <a href={meta.docs} target="_blank" rel="noreferrer" className="text-[11px] font-semibold" style={{ color: meta.color }}>¿Cómo obtener mis credenciales? →</a>
            <button onClick={guardar} disabled={saving} className="btn-primary btn-sm">{saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabMarketingAds() {
  const searchParams = useSearchParams();
  const { data: conexiones = [], refetch } = useQuery<ConexionAds[]>({
    queryKey: ["mkt-conexiones"],
    queryFn: async () => (await (await fetch("/api/marketing/conexiones")).json()).data ?? [],
  });

  // Mostrar resultado del callback OAuth
  const oauth = searchParams.get("oauth");
  if (oauth && typeof window !== "undefined") {
    const msg = searchParams.get("msg") ?? "";
    setTimeout(() => { oauth === "ok" ? toast.success(msg) : toast.error(msg || "Error de conexión"); window.history.replaceState({}, "", "/configuracion?tab=marketing"); }, 100);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, #db277712, transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#db2777" }}><Radio size={22} className="text-white" /></div>
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Conexiones de publicidad (Ads)</h2>
          <p className="text-xs text-muted mt-0.5">Guarda las credenciales de tu app y conecta cada plataforma vía OAuth para importar métricas al módulo de Marketing.</p>
        </div>
      </div>
      {conexiones.map(c => <PlataformaCard key={c.plataforma} conn={c} onSaved={refetch} />)}
      <div className="card p-4">
        <p className="text-[11px] text-muted"><b>Cómo funciona:</b> 1) Registra una app en la plataforma (Google Cloud / Meta for Developers / TikTok Business). 2) Pega el Client ID y Secret aquí. 3) Pulsa "Conectar cuenta" y autoriza. Mientras tanto puedes cargar campañas manualmente en <b>Marketing → Campañas</b>. La <b>URL de redirección</b> a registrar en cada app es: <code className="surface-3 px-1 rounded break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/marketing/oauth/callback</code></p>
      </div>
    </div>
  );
}

function TabIA() {
  const [proveedor, setProveedor] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState("");
  const [configurada, setConfigurada] = useState(false);
  const [saving, setSaving] = useState(false);

  useQuery({
    queryKey: ["ai-config"],
    queryFn: async () => {
      const j = await (await fetch("/api/ai/config")).json();
      if (j.success) { setProveedor(j.data.proveedor); setModelo(j.data.modelo); setConfigurada(j.data.configurada); }
      return j;
    },
  });

  const guardar = async () => {
    setSaving(true);
    const res = await fetch("/api/ai/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proveedor, apiKey: apiKey || undefined, modelo }) });
    setSaving(false);
    if ((await res.json()).success) { toast.success("Configuración de IA guardada"); setApiKey(""); setConfigurada(true); }
    else toast.error("Error al guardar");
  };
  const quitar = async () => {
    if (!confirm("¿Quitar la API key de IA?")) return;
    await fetch("/api/ai/config", { method: "DELETE" });
    toast.success("API key eliminada"); setConfigurada(false);
  };

  const modeloDefault = proveedor === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}><Sparkles size={22} className="text-white" /></div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Inteligencia Artificial</h2>
          <p className="text-xs text-muted mt-0.5">Conecta una API de IA para activar el asistente generativo, auto-descripciones, SEO automático y el AI Marketing Advisor.</p>
        </div>
        {configurada && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 rounded-lg">Activa</span>}
      </div>
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Proveedor</label>
          <div className="flex gap-2">
            {[{ v: "openai", l: "OpenAI (GPT)" }, { v: "anthropic", l: "Anthropic (Claude)" }].map(p => (
              <button key={p.v} onClick={() => setProveedor(p.v)} className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={proveedor === p.v ? { backgroundColor: "var(--brand-color)", color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>{p.l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">API Key {configurada && <span className="text-emerald-500 normal-case">(guardada — déjala vacía para no cambiar)</span>}</label>
          <input type="password" className="input font-mono text-xs" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={proveedor === "anthropic" ? "sk-ant-..." : "sk-..."} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Modelo (opcional)</label>
          <input className="input font-mono text-xs" value={modelo} onChange={e => setModelo(e.target.value)} placeholder={modeloDefault} />
          <p className="text-[11px] text-muted mt-1">Por defecto: <code className="surface-3 px-1 rounded">{modeloDefault}</code></p>
        </div>
        <div className="flex gap-2">
          <button onClick={guardar} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar</button>
          {configurada && <button onClick={quitar} className="btn-secondary">Quitar key</button>}
        </div>
      </div>
      <p className="text-[11px] text-muted">La API key se guarda cifrada (AES-256). Mientras no la configures, el asistente flotante sigue funcionando en modo básico (lee el estado del negocio sin IA generativa).</p>

      {/* Guía: qué hace la IA y dónde se usa */}
      <div className="card p-5">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-3"><Sparkles size={15} style={{ color: "var(--brand-color)" }} /> ¿Qué hace la IA en el sistema?</p>
        <p className="text-xs text-muted mb-3">Se usa <b>un solo proveedor centralizado</b> (el que configures aquí) en todas las funciones de IA:</p>
        <ul className="space-y-2 text-xs text-soft">
          <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--brand-color)" }}>1.</span> <span><b>Asistente flotante</b>: responde preguntas del negocio respetando el rol del usuario.</span></li>
          <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--brand-color)" }}>2.</span> <span><b>Productos · SEO</b>: genera meta título, descripción, keywords y texto SEO automáticamente.</span></li>
          <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--brand-color)" }}>3.</span> <span><b>Productos · Ficha técnica</b>: analiza el PDF cargado y sugiere los campos del producto.</span></li>
          <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--brand-color)" }}>4.</span> <span><b>Nexus</b>: respuestas asistidas a clientes usando la info de productos y cotizaciones.</span></li>
          <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--brand-color)" }}>5.</span> <span><b>Growth</b>: análisis de campañas (AI Marketing Advisor).</span></li>
        </ul>
        <div className="mt-3 pt-3 border-t divider text-[11px] text-muted">
          <p className="font-semibold text-soft mb-1">Cómo obtener tu API key:</p>
          <p>• <b>OpenAI</b>: platform.openai.com → API keys → Create new secret key.</p>
          <p>• <b>Anthropic</b>: console.anthropic.com → API keys. Recomendado el modelo <code className="surface-3 px-1 rounded">claude-3-5-haiku</code> (rápido y económico).</p>
        </div>
      </div>
    </div>
  );
}

function TabFacturacion() {
  const [f, setF] = useState({ proveedor: "manual", apiUrl: "", apiKey: "", prefijo: "FE", numeroResolucion: "", rangoDesde: "1", rangoHasta: "1000", consecutivoActual: "1", ivaPorDefecto: "19", tieneApiKey: false });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  useQuery({ queryKey: ["fact-config"], queryFn: async () => {
    const j = await (await fetch("/api/facturacion/config")).json();
    if (j.success) setF(p => ({ ...p, ...j.data, rangoDesde: String(j.data.rangoDesde), rangoHasta: String(j.data.rangoHasta), consecutivoActual: String(j.data.consecutivoActual), ivaPorDefecto: String(j.data.ivaPorDefecto), apiKey: "" }));
    return j;
  } });
  const guardar = async () => {
    setSaving(true);
    const res = await fetch("/api/facturacion/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, apiKey: f.apiKey || undefined }) });
    setSaving(false);
    if ((await res.json()).success) toast.success("Configuración de facturación guardada");
    else toast.error("Error al guardar");
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}><Building2 size={22} className="text-white" /></div>
        <div><h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Facturación electrónica (DIAN)</h2><p className="text-xs text-muted mt-0.5">Configura el proveedor tercero y los datos de la resolución DIAN.</p></div>
      </div>
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Proveedor</label>
          <select className="input" value={f.proveedor} onChange={e => u("proveedor", e.target.value)}>
            <option value="manual">Manual (sin DIAN)</option>
            <option value="factus">Factus</option>
            <option value="siigo">Siigo</option>
            <option value="alegra">Alegra</option>
          </select>
        </div>
        {f.proveedor !== "manual" && (
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">API URL</label><input className="input font-mono text-xs" value={f.apiUrl} onChange={e => u("apiUrl", e.target.value)} placeholder="https://api.proveedor.com" /></div>
            <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">API Key {f.tieneApiKey && <span className="text-emerald-500 normal-case">(guardada)</span>}</label><input type="password" className="input font-mono text-xs" value={f.apiKey} onChange={e => u("apiKey", e.target.value)} placeholder="••••••••" /></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">Prefijo</label><input className="input" value={f.prefijo} onChange={e => u("prefijo", e.target.value)} placeholder="FE" /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">N° Resolución DIAN</label><input className="input" value={f.numeroResolucion} onChange={e => u("numeroResolucion", e.target.value)} placeholder="18760000001" /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">Rango desde</label><input type="number" className="input" value={f.rangoDesde} onChange={e => u("rangoDesde", e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">Rango hasta</label><input type="number" className="input" value={f.rangoHasta} onChange={e => u("rangoHasta", e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">Consecutivo actual</label><input type="number" className="input" value={f.consecutivoActual} onChange={e => u("consecutivoActual", e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-1.5">IVA por defecto (%)</label><input type="number" className="input" value={f.ivaPorDefecto} onChange={e => u("ivaPorDefecto", e.target.value)} /></div>
        </div>
        <button onClick={guardar} disabled={saving} className="btn-primary w-full justify-center">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar</button>
      </div>
      <p className="text-[11px] text-muted">En modo "Manual" las facturas se generan sin enviar a la DIAN. Al elegir un proveedor (Factus/Siigo/Alegra) y guardar sus credenciales, el botón "Emitir" enviará la factura electrónica.</p>
    </div>
  );
}

const TABS = [
  { id: "empresa",      label: "Empresa",       icon: Building2   },
  { id: "ia",           label: "IA",            icon: Sparkles    },
  { id: "facturacion",  label: "Facturación",   icon: Building2   },
  { id: "canales",      label: "Canales & Redes", icon: Radio     },
  { id: "marketing",    label: "Conexiones Ads", icon: Radio      },
  { id: "woocommerce",  label: "WooCommerce",   icon: Link2       },
  { id: "falabella",    label: "Falabella",     icon: ShoppingBag },
  { id: "mercadolibre", label: "MercadoLibre",  icon: Store       },
  { id: "wp_users",     label: "Usuarios WP",   icon: Users       },
];

function ConfiguracionContent() {
  const searchParams = useSearchParams();
  const { brand } = useBrand();
  const { user } = useAuth();

  // Conexiones e IA: solo superadmin. Empresa: admin+superadmin.
  const superadmin = user?.rol === "SUPERADMIN";
  const soloSuper = new Set(["ia", "facturacion", "canales", "marketing", "woocommerce", "falabella", "mercadolibre", "wp_users"]);
  const tabsVisibles = TABS.filter(t => superadmin || !soloSuper.has(t.id));

  const initial = searchParams.get("tab") ?? "empresa";
  const [tab, setTab] = useState(tabsVisibles.some(t => t.id === initial) ? initial : "empresa");
  return (
    <>
      <Topbar title="Configuración" />
      <div className="flex-1 overflow-y-auto page-bg">
        <div className="bg-white dark:bg-slate-900 px-6 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex gap-0.5 min-w-max">
            {tabsVisibles.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-4 py-3.5 text-[12px] font-medium border-b-2 transition-all whitespace-nowrap"
                  style={active ? { borderBottomColor: brand.brandColor, color: brand.brandColor } : { borderBottomColor: "transparent", color: "var(--text-muted)" }}>
                  <Icon size={13} />{t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-6">
          {tab === "empresa"      && <TabEmpresa />}
          {tab === "ia"           && <TabIA />}
          {tab === "facturacion"  && <TabFacturacion />}
          {tab === "canales"      && <TabCanales />}
          {tab === "marketing"    && <TabMarketingAds />}
          {tab === "woocommerce"  && <TabWooCommerce />}
          {tab === "falabella"    && (
            <TabMarketplace nombre="Falabella Marketplace" color="#9b0000" logoChar="F"
              descripcion="Gestiona pedidos y productos en Falabella.com"
              camposExtra={[{ key: "sellerId", label: "Seller ID", placeholder: "Tu ID de vendedor" }]} />
          )}
          {tab === "mercadolibre" && (
            <TabMarketplace nombre="MercadoLibre" color="#ffe600" logoChar="ML"
              descripcion="Sincroniza publicaciones y pedidos de MercadoLibre"
              camposExtra={[{ key: "accessToken", label: "Access Token", placeholder: "APP_USR-..." }]} />
          )}
          {tab === "wp_users"     && <TabWordPressUsers />}
        </div>
      </div>
    </>
  );
}

export default function ConfiguracionPage() {
  return <Suspense><ConfiguracionContent /></Suspense>;
}
