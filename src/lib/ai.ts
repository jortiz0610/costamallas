// ============================================================
// COSTAMALLAS ERP — Integración de IA generativa (OpenAI / Anthropic)
// La API key se guarda cifrada en Configuracion. Si no hay key,
// el asistente sigue funcionando en modo reglas (sin IA generativa).
// ============================================================

import { prisma } from "@/lib/prisma";
import { decryptIfNeeded } from "@/lib/encryption";

export type Proveedor = "openai" | "anthropic";

export interface AIConfig { proveedor: Proveedor; apiKey: string; modelo: string; }

export async function getAIConfig(): Promise<AIConfig | null> {
  const rows = await prisma.configuracion.findMany({
    where: { clave: { in: ["ai_provider", "ai_api_key", "ai_model"] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.clave, r]));
  const keyRow = map["ai_api_key"];
  if (!keyRow?.valor) return null;
  const proveedor = (map["ai_provider"]?.valor as Proveedor) ?? "openai";
  const apiKey = keyRow.encrypted ? decryptIfNeeded(keyRow.valor) : keyRow.valor;
  const modelo = map["ai_model"]?.valor || (proveedor === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini");
  return { proveedor, apiKey, modelo };
}

export async function chatAI(system: string, userMessage: string, cfg: AIConfig): Promise<string> {
  if (cfg.proveedor === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: cfg.modelo, max_tokens: 700, system,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return j.content?.[0]?.text ?? "No obtuve respuesta.";
  }

  // OpenAI (por defecto)
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.modelo, max_tokens: 700,
      messages: [{ role: "system", content: system }, { role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "No obtuve respuesta.";
}
