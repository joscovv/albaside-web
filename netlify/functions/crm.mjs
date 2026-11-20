// netlify/functions/crm.mjs
// CRM de Albaside: guarda las parejas en Netlify Blobs (almacén "crm", una clave por pareja).
// Lo usan /crm (panel privado) y cal-webhook.js (cada reserva de Cal.com entra sola).
// Protegido con la misma ADMIN_KEY del panel de testimonios.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const same = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };

const ETAPAS = ["Consulta", "Videollamada agendada", "Propuesta enviada", "Reservó (20%)", "Boda realizada", "En edición", "Entregado", "Perdido"];
const TXT = ["nombres", "whatsapp", "email", "fechaBoda", "lugar", "origen", "etapa", "notas", "proximaAccion", "proximaFecha", "entregaLimite", "llamada", "moneda"];
const NUM = ["paquete", "pagado"];
const BOOL = ["anticipoPagado", "entregado", "testimonioPedido"];

function limpiar(p, prev = {}) {
  const o = { ...prev };
  for (const k of TXT) if (k in p) o[k] = String(p[k] ?? "").slice(0, k === "notas" ? 5000 : 300);
  for (const k of NUM) if (k in p) o[k] = p[k] === "" || p[k] == null ? null : Math.max(0, Number(p[k]) || 0);
  for (const k of BOOL) if (k in p) o[k] = !!p[k];
  if (!ETAPAS.includes(o.etapa)) o.etapa = "Consulta";
  return o;
}

export default async (req) => {
  const KEY = process.env.ADMIN_KEY;
  if (!KEY) return json({ error: "Falta ADMIN_KEY en Netlify." }, 500);
  if (!same(req.headers.get("x-admin-key"), KEY)) return json({ error: "Clave incorrecta." }, 401);
  const store = getStore("crm");

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "p/" });
    const parejas = (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean);
    return json({ parejas, etapas: ETAPAS });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const b = await req.json().catch(() => ({}));
  const ahora = new Date().toISOString();

  if (b.accion === "guardar") {
    const id = b.pareja?.id || crypto.randomUUID();
    const prev = (await store.get("p/" + id, { type: "json" })) || { id, creado: ahora };
    const p = limpiar(b.pareja || {}, prev);
    p.id = id; p.actualizado = ahora;
    if (!p.nombres?.trim()) return json({ error: "Escribe al menos los nombres." }, 400);
    await store.setJSON("p/" + id, p);
    return json({ ok: true, pareja: p });
  }

  if (b.accion === "borrar") {
    if (!b.id) return json({ error: "Falta el id." }, 400);
    await store.delete("p/" + b.id);
    return json({ ok: true });
  }

  if (b.accion === "lead") {
    // Llega desde cal-webhook.js. Si la pareja ya existe (mismo id de reserva), solo actualiza la llamada.
    const id = "cal_" + String(b.uid || crypto.randomUUID()).replace(/[^\w-]/g, "");
    const prev = await store.get("p/" + id, { type: "json" });
    const navidad = b.tipo === "navidad";
    const base = prev || { id, creado: ahora, etapa: navidad ? "Consulta" : "Videollamada agendada", origen: navidad ? "Sesión de Navidad (Cal.com)" : "Web (Cal.com)" };
    const p = limpiar({ nombres: b.nombres, email: b.email, whatsapp: b.whatsapp, llamada: b.llamada, notas: prev ? prev.notas : (b.notas || "") }, base);
    p.id = id; p.actualizado = ahora;
    if (!prev) {
      p.proximaAccion = navidad ? "Confirmar adelanto Yape S/ 50 · sesión de Navidad" : "Videollamada";
      p.proximaFecha = navidad ? ahora.slice(0, 10) : (b.llamada || "").slice(0, 10);
      if (navidad) p.notas = ["Sesión de Navidad: " + (b.llamada ? new Date(b.llamada).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "full", timeStyle: "short" }) : ""), b.notas || ""].filter(Boolean).join("\n");
    }
    await store.setJSON("p/" + id, p);
    return json({ ok: true });
  }

  return json({ error: "Acción desconocida." }, 400);
};

export const config = { path: "/api/crm" };
