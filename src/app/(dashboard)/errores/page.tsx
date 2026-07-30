// La antigua pantalla de "Errores de validación" era un placeholder: no
// leía datos reales (su fetch apuntaba a /api/productos y ni se usaba).
// Todo quedó unificado en "Reporte de errores" (/sistema/reportes), que es
// el módulo que sí recibe lo que reportan los usuarios y permite darle
// seguimiento. Se deja la redirección para que enlaces y marcadores
// antiguos no caigan en un 404.

import { redirect } from "next/navigation";

export default function ErroresPage() {
  redirect("/sistema/reportes");
}
