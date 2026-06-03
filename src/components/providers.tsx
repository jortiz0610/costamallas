"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import { BrandProvider } from "@/contexts/BrandContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrandProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: "text-sm font-medium",
            success: { duration: 3000, style: { background: "#27AE60", color: "#fff" } },
            error: { duration: 5000, style: { background: "#C0392B", color: "#fff" } },
          }}
        />
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
      </BrandProvider>
    </QueryClientProvider>
  );
}
