"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery } from "@tanstack/react-query";

async function fetchKPIs() {
  const res = await fetch("/api/dashboard/kpis");
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({ queryKey: ["dashboard", "kpis"], queryFn: fetchKPIs, staleTime: 60_000 });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        stockCriticos={data?.stock?.criticos ?? 0}
        erroresPendientes={data?.woocommerce?.erroresPendientes ?? 0}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
