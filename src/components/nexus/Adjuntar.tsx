"use client";

// ============================================================
// Cámara, archivo y nota de voz — como en WhatsApp.
//
// Lo usan los dos chats (el de clientes y el del equipo), así que vive
// aquí y no dentro de ninguno de los dos.
//
// Tres decisiones que conviene no deshacer:
//
//   1. La cámara es un `<input capture>`, no `getUserMedia`. En el
//      teléfono abre la cámara nativa —con su enfoque, su flash y su
//      botón grande— en vez de un visor casero dentro de la página. En
//      escritorio el mismo input abre el explorador de archivos, que es
//      lo correcto ahí.
//   2. La nota de voz se graba con `MediaRecorder` y NO se manda sola:
//      queda a la vista con un botón de escuchar y otro de borrar. Un
//      audio que sale al soltar el dedo es el que uno manda por error.
//   3. Nada se sube hasta que hay algo que subir. Pedir permiso de
//      micrófono al abrir el chat asusta y la gente lo niega para
//      siempre.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Camera, Paperclip, Mic, Square, Trash2, Loader2, Play, Pause } from "lucide-react";
import toast from "react-hot-toast";

export interface Adjunto {
  url: string;
  tipo: "imagen" | "audio" | "video" | "archivo";
  nombre: string;
  tamano: number;
  mime: string;
}

/** Sube el archivo y devuelve el adjunto, o null si algo falló. */
async function subir(file: File): Promise<Adjunto | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/nexus/adjunto", { method: "POST", body: fd });
  const json = await res.json().catch(() => ({ error: "Respuesta ilegible del servidor" }));
  if (!res.ok || !json.success) {
    toast.error(json.error ?? "No se pudo subir", { duration: 8000 });
    return null;
  }
  return json.data as Adjunto;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Adjuntar({
  onAdjunto,
  deshabilitado,
}: {
  onAdjunto: (a: Adjunto) => void;
  deshabilitado?: boolean;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  // ── Nota de voz ──
  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [borrador, setBorrador] = useState<{ blob: Blob; url: string } | null>(null);
  const [sonando, setSonando] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!grabando) return;
    const t = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [grabando]);

  // Soltar el micrófono y el objeto URL al desmontar: si no, el punto
  // rojo de "grabando" se queda encendido en el navegador después de
  // cerrar el chat.
  useEffect(() => () => {
    grabadora.current?.stream.getTracks().forEach(t => t.stop());
    if (borrador) URL.revokeObjectURL(borrador.url);
  }, [borrador]);

  const elegido = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // que elegir el mismo archivo dos veces vuelva a disparar
    if (!file) return;
    setSubiendo(true);
    const a = await subir(file);
    setSubiendo(false);
    if (a) onAdjunto(a);
  };

  const empezar = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return toast.error("Este navegador no deja grabar audio.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      trozos.current = [];
      mr.ondataavailable = ev => { if (ev.data.size) trozos.current.push(ev.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(trozos.current, { type: mr.mimeType || "audio/webm" });
        setBorrador({ blob, url: URL.createObjectURL(blob) });
      };
      mr.start();
      grabadora.current = mr;
      setSegundos(0);
      setGrabando(true);
    } catch {
      toast.error("No diste permiso al micrófono, o no hay ninguno.");
    }
  };

  const parar = () => {
    grabadora.current?.stop();
    setGrabando(false);
  };

  const descartar = () => {
    if (borrador) URL.revokeObjectURL(borrador.url);
    setBorrador(null);
    setSonando(false);
    audioRef.current?.pause();
  };

  const escuchar = () => {
    if (!borrador) return;
    if (!audioRef.current) audioRef.current = new Audio(borrador.url);
    if (sonando) { audioRef.current.pause(); setSonando(false); return; }
    audioRef.current.onended = () => setSonando(false);
    void audioRef.current.play();
    setSonando(true);
  };

  const mandarAudio = async () => {
    if (!borrador) return;
    setSubiendo(true);
    const ext = borrador.blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([borrador.blob], `nota-de-voz-${Date.now()}.${ext}`, { type: borrador.blob.type });
    const a = await subir(file);
    setSubiendo(false);
    if (a) { onAdjunto(a); descartar(); }
  };

  // ── Con una nota grabada, la barra cambia entera ──
  if (borrador) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 rounded-xl surface-2">
        <button onClick={descartar} aria-label="Borrar la nota de voz"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
          <Trash2 size={16} />
        </button>
        <button onClick={escuchar} aria-label={sonando ? "Pausar" : "Escuchar"}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-soft hover:surface-3 flex-shrink-0">
          {sonando ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="text-[12px] text-soft flex-1 min-w-0 truncate">Nota de voz · {mmss(segundos)}</span>
        <button onClick={mandarAudio} disabled={subiendo}
          className="btn-primary btn-sm flex-shrink-0 disabled:opacity-50">
          {subiendo ? <Loader2 size={13} className="animate-spin" /> : null} Adjuntar
        </button>
      </div>
    );
  }

  // ── Grabando ──
  if (grabando) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <span className="text-[12px] font-semibold text-red-600 dark:text-red-400 flex-1">
          Grabando… {mmss(segundos)}
        </span>
        <button onClick={parar} className="btn-primary btn-sm flex-shrink-0">
          <Square size={12} /> Parar
        </button>
      </div>
    );
  }

  // ── Barra normal ──
  return (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={elegido} />
      <input ref={fileRef} type="file" accept="image/*,audio/*,video/*,application/pdf" className="hidden" onChange={elegido} />

      <button onClick={() => camRef.current?.click()} disabled={deshabilitado || subiendo}
        title="Tomar una foto" aria-label="Tomar una foto"
        className="w-10 h-10 rounded-xl flex items-center justify-center border divider text-muted hover:surface-2 transition-all disabled:opacity-50 flex-shrink-0">
        {subiendo ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
      </button>

      <button onClick={() => fileRef.current?.click()} disabled={deshabilitado || subiendo}
        title="Adjuntar un archivo" aria-label="Adjuntar un archivo"
        className="w-10 h-10 rounded-xl flex items-center justify-center border divider text-muted hover:surface-2 transition-all disabled:opacity-50 flex-shrink-0">
        <Paperclip size={16} />
      </button>

      <button onClick={empezar} disabled={deshabilitado || subiendo}
        title="Grabar una nota de voz" aria-label="Grabar una nota de voz"
        className="w-10 h-10 rounded-xl flex items-center justify-center border divider text-muted hover:surface-2 transition-all disabled:opacity-50 flex-shrink-0">
        <Mic size={16} />
      </button>
    </>
  );
}
