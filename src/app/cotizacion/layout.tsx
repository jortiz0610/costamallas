import type { Metadata } from "next";

// ============================================================
// Todo lo que cuelga de /cotizacion es público a propósito: el cliente
// abre su oferta sin cuenta. Pero una cotización lleva el nombre del
// cliente, lo que compró y a qué precio.
//
// El token es imposible de adivinar, pero eso no basta: si alguien pega
// el enlace en un foro, un grupo público o una firma de correo, el
// buscador lo sigue y la oferta queda indexada para siempre. Por eso se
// marca noindex en todo el segmento.
// ============================================================

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function CotizacionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
