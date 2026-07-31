// El módulo de tareas se retiró del CRM: no aportaba sobre lo que ya
// resuelven el pipeline (seguimiento comercial) y las instalaciones
// (trabajo agendado), y dispersaba dónde mirar los pendientes.
//
// Los datos y la API (/api/crm/tareas) se conservan, así que si más
// adelante se quiere reactivar solo hay que volver a poner el enlace en
// el Sidebar. Mientras tanto, esta ruta redirige al pipeline.

import { redirect } from "next/navigation";

export default function TareasPage() {
  redirect("/crm/pipeline");
}
