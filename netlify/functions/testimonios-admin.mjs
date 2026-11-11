// netlify/functions/testimonios-admin.mjs
// Privado: lo usa /admin-testimonios.html para listar lo que llegó por el formulario
// y publicar u ocultar cada testimonio.
// Variables de entorno en Netlify:
//   ADMIN_KEY          → la clave que escribes en la página de administración
//   NETLIFY_API_TOKEN  → token personal de Netlify (para leer los envíos del formulario)
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const same = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

export default async (req, context) => {
  const ADMIN_KEY = process.env.ADMIN_KEY, TOKEN = process.env.NETLIFY_API_TOKEN;
  if (!ADMIN_KEY || !TOKEN) return json({ error: "Faltan ADMIN_KEY o NETLIFY_API_TOKEN en Netlify." }, 500);
  if (!same(req.headers.get("x-admin-key"), ADMIN_KEY)) return json({ error: "Clave incorrecta." }, 401);

  const store = getStore("testimonios");
  const publicados = (await store.get("publicados", { type: "json" })) || [];

  if (req.method === "GET") {
    const api = "https://api.netlify.com/api/v1";
    const h = { Authorization: "Bearer " + TOKEN };
    const forms = await fetch(`${api}/sites/${context.site.id}/forms`, { headers: h }).then(r => r.json());
    const form = Array.isArray(forms) && forms.find(f => f.name === "testimonios");
    if (!form) return json({ envios: [], publicados });
    const subs = await fetch(`${api}/forms/${form.id}/submissions?per_page=100`, { headers: h }).then(r => r.json());
    const envios = (Array.isArray(subs) ? subs : []).map(s => ({
      id: s.id, fecha: s.created_at,
      nombres: s.data?.nombres || "", lugar: s.data?.lugar || "", testimonio: s.data?.testimonio || "",
      contacto: s.data?.contacto || "", autorizado: !!s.data?.autorizacion
    }));
    return json({ envios, publicados });
  }

  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (!b.id) return json({ error: "Falta el id." }, 400);
    let lista = publicados.filter(t => t.id !== b.id);
    if (b.accion === "publicar") {
      const t = { id: b.id, nombres: String(b.nombres || "").slice(0, 120), lugar: String(b.lugar || "").slice(0, 120), testimonio: String(b.testimonio || "").slice(0, 1500) };
      if (!t.testimonio.trim()) return json({ error: "El testimonio está vacío." }, 400);
      const pos = publicados.findIndex(x => x.id === b.id);
      if (pos >= 0) lista.splice(pos, 0, t); else lista.unshift(t);
    }
    await store.setJSON("publicados", lista);
    return json({ ok: true, publicados: lista });
  }

  return json({ error: "Método no permitido." }, 405);
};

export const config = { path: "/api/testimonios-admin" };
