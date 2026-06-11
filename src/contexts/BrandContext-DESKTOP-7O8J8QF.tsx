"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface BrandConfig {
  companyName: string;
  brandColor: string;
  logoUrl: string | null;
  icoUrl: string | null;
  legalName: string;
  nit: string;
  address: string;
  phone: string;
  email: string;
}

interface BrandContextValue {
  brand: BrandConfig;
  darkMode: boolean;
  mode: "ERP" | "CRM" | "NEXUS" | "MARKETING";
  setBrand: (b: Partial<BrandConfig>) => void;
  toggleDark: () => void;
  setMode: (m: "ERP" | "CRM" | "NEXUS" | "MARKETING") => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

const DEFAULT_BRAND: BrandConfig = {
  companyName: "Mi Empresa",
  brandColor: "#6366f1",
  logoUrl: null,
  icoUrl: null,
  legalName: "",
  nit: "",
  address: "",
  phone: "",
  email: "",
};

const BrandContext = createContext<BrandContextValue>({
  brand: DEFAULT_BRAND,
  darkMode: false,
  mode: "ERP",
  setBrand: () => {},
  toggleDark: () => {},
  setMode: () => {},
  sidebarOpen: false,
  setSidebarOpen: () => {},
});

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrandState] = useState<BrandConfig>(DEFAULT_BRAND);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setModeState] = useState<"ERP" | "CRM" | "NEXUS" | "MARKETING">("ERP");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Cargar desde localStorage primero (instantáneo)
    try {
      const stored = localStorage.getItem("cm_brand");
      if (stored) setBrandState({ ...DEFAULT_BRAND, ...JSON.parse(stored) });
      const dark = localStorage.getItem("cm_dark") === "true";
      setDarkMode(dark);
    } catch {}
    setMounted(true);

    // Luego sincronizar desde DB (para multi-dispositivo)
    fetch("/api/configuracion/empresa")
      .then(r => r.json())
      .then(json => {
        if (!json.success || !json.data) return;
        const d = json.data;
        const fromDb: Partial<BrandConfig> = {};
        if (d.empresa_nombre) fromDb.companyName = d.empresa_nombre;
        if (d.empresa_legal)  fromDb.legalName   = d.empresa_legal;
        if (d.empresa_nit)    fromDb.nit          = d.empresa_nit;
        if (d.empresa_direccion) fromDb.address   = d.empresa_direccion;
        if (d.empresa_telefono)  fromDb.phone     = d.empresa_telefono;
        if (d.empresa_email)  fromDb.email        = d.empresa_email;
        if (d.empresa_color)  fromDb.brandColor   = d.empresa_color;
        if (d.empresa_logo)   fromDb.logoUrl      = d.empresa_logo;
        if (d.empresa_ico)    fromDb.icoUrl       = d.empresa_ico;
        if (Object.keys(fromDb).length > 0) {
          setBrandState(prev => ({ ...prev, ...fromDb }));
          localStorage.setItem("cm_brand", JSON.stringify({ ...DEFAULT_BRAND, ...fromDb }));
        }
      })
      .catch(() => {});
  }, []);

  // Aplicar dark mode y brand color al DOM
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [darkMode, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    // Color corporativo base
    root.style.setProperty("--brand-color", brand.brandColor);
    root.style.setProperty("--brand-color-10", brand.brandColor + "1a");
    root.style.setProperty("--brand-color-20", brand.brandColor + "33");
  }, [brand.brandColor, mounted]);

  const setBrand = useCallback((partial: Partial<BrandConfig>) => {
    setBrandState(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem("cm_brand", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem("cm_dark", String(next));
      return next;
    });
  }, []);

  const setMode = useCallback((m: "ERP" | "CRM" | "NEXUS" | "MARKETING") => setModeState(m), []);

  if (!mounted) return null;

  return (
    <BrandContext.Provider value={{ brand, darkMode, mode, setBrand, toggleDark, setMode, sidebarOpen, setSidebarOpen }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
