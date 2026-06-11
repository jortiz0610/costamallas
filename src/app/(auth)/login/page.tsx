"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowLeft, HelpCircle, Smartphone, X } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

function GuiaAuth({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Smartphone size={16} style={{ color: "var(--brand-color)" }} /> Configurar Google Authenticator</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <ol className="space-y-2.5 text-sm text-gray-600 dark:text-gray-300 list-decimal list-inside">
          <li>Instala <b>Google Authenticator</b> (o Authy / Microsoft Authenticator) desde la tienda de tu teléfono.</li>
          <li>Ábrela y toca el botón <b>+</b> (agregar).</li>
          <li>Elige <b>"Escanear código QR"</b> y apunta la cámara al código de la pantalla.</li>
          <li>La app mostrará un <b>código de 6 dígitos</b> que cambia cada 30 segundos.</li>
          <li>Escribe ese código aquí para confirmar y entrar.</li>
        </ol>
        <p className="text-[11px] text-gray-400 mt-4">A partir de ahora, cada vez que inicies sesión en un dispositivo nuevo te pediremos el código de la app.</p>
        <button onClick={onClose} className="btn-primary w-full justify-center mt-4">Entendido</button>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [need2fa, setNeed2fa] = useState(false);
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [showGuia, setShowGuia] = useState(false);
  const [code, setCode] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code: need2fa ? code : undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.twoFactorSetupRequired) {
          setNeed2fa(true);
          setSetupQr(json.qr ?? null);
          if (code) toast.error(json.error ?? "Código incorrecto");
          return;
        }
        if (json.twoFactorRequired) {
          setNeed2fa(true);
          setSetupQr(null);
          if (code) toast.error(json.error ?? "Código incorrecto");
          return;
        }
        toast.error(json.error ?? "Credenciales incorrectas");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success(`Bienvenido, ${json.data.nombre}`);
      router.push(params.get("from") ?? "/");
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-6 text-center" style={{ backgroundColor: "var(--brand-color)" }}>
        <div className="text-white font-bold text-lg tracking-widest uppercase">Portal ERP</div>
        <p className="text-white/70 text-sm mt-1">Sistema de gestion empresarial</p>
      </div>
      <div className="p-8">
        {need2fa ? (
          <>
            <button type="button" onClick={() => { setNeed2fa(false); setCode(""); setSetupQr(null); }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"><ArrowLeft size={12} /> Volver</button>
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{setupQr ? "Configura tu doble autenticación" : "Verificación en dos pasos"}</h1>
                <button type="button" onClick={() => setShowGuia(true)} title="¿Cómo configurar?" className="text-gray-400 hover:text-[var(--brand-color)]"><HelpCircle size={16} /></button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {setupQr ? "Tu administrador activó la verificación. Escanea el QR con Google Authenticator." : "Ingresa el código de 6 dígitos de tu app de autenticación"}
              </p>
            </div>
            {setupQr ? (
              <div className="flex flex-col items-center mb-4">
                <Image src={setupQr} alt="QR 2FA" width={180} height={180} className="rounded-xl border border-gray-200 bg-white p-2" unoptimized />
                <button type="button" onClick={() => setShowGuia(true)} className="text-xs font-semibold mt-2 flex items-center gap-1" style={{ color: "var(--brand-color)" }}><HelpCircle size={12} /> Ver guía paso a paso</button>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--brand-color-10)" }}>
                <ShieldCheck size={26} style={{ color: "var(--brand-color)" }} />
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus
                className="input text-center text-2xl tracking-[0.4em] font-mono py-3" placeholder="000000" inputMode="numeric" disabled={loading} />
              <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full justify-center py-2.5">
                {loading ? <><Loader2 size={15} className="animate-spin" /> {setupQr ? "Activando..." : "Verificando..."}</> : (setupQr ? "Confirmar y activar" : "Verificar e ingresar")}
              </button>
            </form>
            {showGuia && <GuiaAuth onClose={() => setShowGuia(false)} />}
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">Iniciar sesion</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Accede con tu cuenta corporativa</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Correo electronico</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input pl-9" placeholder="correo@empresa.com"
                    required autoComplete="email" disabled={loading} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contrasena</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPass ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pl-9 pr-10" placeholder="..." required autoComplete="current-password" disabled={loading} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading || !email || !password}
                className="btn-primary w-full justify-center py-2.5 mt-2">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Ingresando...</> : "Ingresar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
