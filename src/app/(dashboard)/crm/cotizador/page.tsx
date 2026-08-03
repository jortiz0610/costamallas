import { redirect } from "next/navigation";

// El cotizador a medida se fusionó con el de cotizaciones: eran dos
// pantallas para lo mismo y el vendedor tenía que adivinar cuál abrir.
// Peor: si un negocio mezclaba producto por cantidad con producto por
// medidas, no había forma de cotizarlo en un solo documento.
//
// Ahora cada línea decide si va por cantidad o por largo × ancho, y el
// check de medidas sale solo en los productos marcados como fabricación
// a medida. La ruta se conserva porque hay costumbre y enlaces sueltos.
export default function CotizadorRedirect() {
  redirect("/crm/cotizaciones/nueva");
}
