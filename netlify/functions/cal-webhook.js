// netlify/functions/cal-webhook.js
// Cuando alguien reserva la videollamada en Cal.com, manda a Meta el evento Schedule (conversión confirmada).
// Configurar en Cal.com: Settings → Developer → Webhooks → New
//   Subscriber URL: https://albaside.com/.netlify/functions/cal-webhook
//   Evento: Booking created
// Variables de entorno en Netlify: META_PIXEL_ID y META_CAPI_TOKEN.

const crypto = require('crypto');
const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
const sha256 = v => v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;

exports.handler = async (event) => {
  if (!PIXEL_ID || !ACCESS_TOKEN) return { statusCode: 200, body: 'skipped: sin configurar' };
  try {
    const body = JSON.parse(event.body || '{}');
    if (body.triggerEvent !== 'BOOKING_CREATED') return { statusCode: 200, body: 'ignorado' };

    const p = body.payload || {};
    const att = (p.attendees || [])[0] || {};
    const phone = att.phoneNumber || att.phone || (p.responses && p.responses.attendeePhoneNumber && p.responses.attendeePhoneNumber.value);
    const payload = {
      data: [{
        event_name: 'Schedule',
        event_time: Math.floor(Date.now() / 1000),
        event_id: 'cal_' + (p.uid || Date.now()),
        action_source: 'other',
        user_data: {
          em: sha256(att.email),
          ph: phone ? sha256(String(phone).replace(/\D/g, '')) : undefined
        },
        custom_data: { content_name: 'Videollamada Albaside' }
      }]
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return { statusCode: 200, body: res.ok ? 'ok' : 'meta respondió ' + res.status };
  } catch (e) {
    return { statusCode: 200, body: 'error silenciado' };
  }
};
