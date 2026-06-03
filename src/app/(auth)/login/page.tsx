"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
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
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.error ?? "Credenciales incorrectas"); return; }
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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
