// netlify/functions/testimonios.mjs
// Público: devuelve SOLO los testimonios que aprobaste en /admin-testimonios.html.
// Se guardan en Netlify Blobs (almacén "testimonios", clave "publicados").
import { getStore } from "@netlify/blobs";

export default async () => {
  let lista = [];
  try {
    lista = (await getStore("testimonios").get("publicados", { type: "json" })) || [];
  } catch (e) { lista = []; }
  const limpio = lista.map(t => ({ nombres: t.nombres, lugar: t.lugar, testimonio: t.testimonio }));
  return new Response(JSON.stringify(limpio), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }
  });
};

export const config = { path: "/api/testimonios" };
