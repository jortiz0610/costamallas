// ============================================================
// POST /api/nexus/adjunto — subir una foto, un audio o un archivo
//                            para mandarlo por un chat
//
// Van a la biblioteca de WordPress, que es el único almacén del portal
// que sirve archivos por una URL pública. Y tiene que ser pública: la
// API de WhatsApp no recibe el archivo, recibe un enlace y lo descarga
// ella. Un almacén privado aquí significaría que el cliente no ve nada.
//
// ⚠️ Eso es exactamente lo que hace que este endpoint NO sirva para los
// documentos de SG-SST: cédulas y planillas son datos personales y no
// pueden quedar en una URL pública. Esos siguen en
// `lib/almacenamiento-documentos.ts`, esperando el disco privado del VPS.
// Aquí van fotos de obra, audios y cotizaciones — cosas que de todas
// formas se le van a mandar al cliente.
//
// Si WordPress rechaza el tipo de archivo (pasa con los audios: la
// instalación por defecto no acepta webm), se devuelve el error REAL del
// servidor. No se guarda un mensaje diciendo que se envió algo que no
// salió de aquí.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { getWPCredentials, uploadToWordPressMedia } from "@/lib/wordpress";

/** Lo que se puede mandar por un chat, y hasta qué tamaño. */
const PERMITIDOS: { prefijo: string; maxMB: number; que: string }[] = [
  { prefijo: "image/", maxMB: 8, que: "foto" },
  { prefijo: "audio/", maxMB: 12, que: "audio" },
  { prefijo: "video/", maxMB: 20, que: "video" },
  { prefijo: "application/pdf", maxMB: 15, que: "PDF" },
];

/** El tipo de mensaje que le corresponde, para pintarlo bien en el chat. */
function tipoDeMensaje(mime: string): "imagen" | "audio" | "video" | "archivo" {
  if (mime.startsWith("image/")) return "imagen";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "archivo";
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return NextResponse.json({ success: false, error: "No llegó ningún archivo" }, { status: 400 });

  const regla = PERMITIDOS.find(p => file.type.startsWith(p.prefijo));
  if (!regla) {
    return NextResponse.json(
      { success: false, error: `No se pueden mandar archivos de tipo ${file.type || "desconocido"} por el chat.` },
      { status: 400 },
    );
  }
  if (file.size > regla.maxMB * 1024 * 1024) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return NextResponse.json(
      { success: false, error: `Ese ${regla.que} pesa ${mb} MB y el tope son ${regla.maxMB} MB.` },
      { status: 400 },
    );
  }

  const creds = await getWPCredentials();
  if (!creds) {
    return NextResponse.json(
      {
        success: false,
        error: "Falta conectar WordPress (Configuración → WordPress). Es donde se guardan los archivos del chat.",
      },
      { status: 503 },
    );
  }

  // Nombre estable y sin sorpresas: los acentos y espacios rompen
  // algunas instalaciones de WordPress al generar la URL.
  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const base = file.name.replace(/\.[^.]+$/, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 40) || "adjunto";
  const filename = `chat-${base}-${Date.now()}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await uploadToWordPressMedia(buffer, filename, file.type);
    return NextResponse.json({
      success: true,
      data: {
        url: media.url,
        tipo: tipoDeMensaje(file.type),
        nombre: file.name,
        tamano: file.size,
        mime: file.type,
      },
    });
  } catch (e) {
    // El error de WordPress se devuelve tal cual. "No se pudo subir" no
    // le dice a nadie que hay que habilitar el tipo de archivo en la
    // instalación, que es lo que suele pasar con los audios.
    const motivo = e instanceof Error ? e.message : String(e);
    console.error("[nexus/adjunto]", motivo);
    return NextResponse.json(
      { success: false, error: `WordPress no aceptó el archivo. ${motivo}` },
      { status: 502 },
    );
  }
}
