"use client";

// ============================================================
// Dónde pueden estar los botones flotantes, y dónde no.
//
// El de soporte y el de Sembli estaban los dos anclados abajo a la
// derecha, uno encima del otro, y en el teléfono caían justo sobre el
// botón de ENVIAR de los chats: se escribía el mensaje y no había forma
// de mandarlo sin cerrar antes un panel que nadie había abierto.
//
// La regla: en una pantalla que tiene caja de escribir, los flotantes se
// apartan en móvil. En escritorio sobra el espacio y se quedan donde
// estaban, que es donde la gente ya los busca.
// ============================================================

import { usePathname } from "next/navigation";

/** Pantallas con caja de escribir abajo. */
const CON_REDACTOR = ["/nexus"];

export function usaRedactor(pathname: string): boolean {
  return CON_REDACTOR.some(r => pathname === r || pathname.startsWith(r + "/"));
}

/**
 * `true` cuando los flotantes deben esconderse en móvil.
 *
 * Solo en móvil: en escritorio el chat no ocupa el ancho entero y los
 * botones no tapan nada.
 */
export function useFlotantesEstorban(): boolean {
  return usaRedactor(usePathname());
}
