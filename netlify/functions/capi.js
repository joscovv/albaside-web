// netlify/functions/capi.js
// Reenvía a Meta, desde el servidor, el mismo evento que ya mandó el navegador.
// El event_id compartido evita que se cuente dos veces.
// Variables de entorno en Netlify: META_PIXEL_ID y META_CAPI_TOKEN.

const crypto = require('crypto');
const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
const STD = ['PageView','ViewContent','Contact','Lead','Schedule','InitiateCheckout','Purchase','CustomizeProduct'];

const sha256 = v => v
  ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex')
  : undefined;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  // Sin credenciales: responde OK para no romper nada en la web, pero lo marca.
  if (!PIXEL_ID || !ACCESS_TOKEN) return { statusCode: 200, body: 'skipped: sin configurar (faltan META_PIXEL_ID / META_CAPI_TOKEN)' };

  try {
    const b = JSON.parse(event.body || '{}');
    if (!b.event_name || !b.event_id) return { statusCode: 400, body: 'faltan datos' };
    const headers = event.headers || {};

    const userData = {
      client_ip_address: headers['x-nf-client-connection-ip'] || headers['client-ip'],
      client_user_agent: headers['user-agent'],
      fbp: b.fbp || undefined,
      fbc: b.fbc || undefined
    };
    if (b.email) userData.em = sha256(b.email);
    if (b.phone) userData.ph = sha256(String(b.phone).replace(/\D/g, ''));

    const payload = {
      data: [{
        event_name: b.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: b.event_id,
        event_source_url: b.event_source_url,
        action_source: 'website',
        user_data: userData,
        custom_data: (b.custom_data && typeof b.custom_data === 'object') ? b.custom_data : undefined
      }]
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    const out = await res.text();
    return { statusCode: res.ok ? 200 : 502, body: out };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};
