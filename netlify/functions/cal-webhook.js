// netlify/functions/cal-webhook.js
// Cuando alguien reserva la videollamada en Cal.com:
//   1) la pareja entra sola al CRM (albaside.com/crm), en la etapa "Videollamada agendada";
//   2) se manda a Meta el evento Schedule (conversión confirmada).
// Configurar en Cal.com: Settings → Developer → Webhooks → New
//   Subscriber URL: https://albaside.com/.netlify/functions/cal-webhook
//   Evento: Booking created
// Variables de entorno en Netlify: META_PIXEL_ID, META_CAPI_TOKEN y ADMIN_KEY.

const crypto = require('crypto');
const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
const ADMIN_KEY = process.env.ADMIN_KEY;
const SITE = process.env.URL || 'https://albaside.com';
const sha256 = v => v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;

exports.handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 200, body: 'json inválido' }; }
  if (body.triggerEvent !== 'BOOKING_CREATED') return { statusCode: 200, body: 'ignorado' };

  const p = body.payload || {};
  const att = (p.attendees || [])[0] || {};
  const phone = att.phoneNumber || att.phone || (p.responses && p.responses.attendeePhoneNumber && p.responses.attendeePhoneNumber.value);
  const notas = p.responses && p.responses.notes && p.responses.notes.value ? 'Nota al reservar: ' + p.responses.notes.value : (p.additionalNotes ? 'Nota al reservar: ' + p.additionalNotes : '');
  const resultado = [];

  // 1) CRM
  if (ADMIN_KEY) {
    try {
      const r = await fetch(SITE + '/api/crm', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify({ accion: 'lead', uid: p.uid, nombres: att.name || '', email: att.email || '', whatsapp: phone || '', llamada: p.startTime || '', notas })
      });
      resultado.push('crm ' + r.status);
    } catch (e) { resultado.push('crm error'); }
  }

  // 2) Meta (Conversions API)
  if (PIXEL_ID && ACCESS_TOKEN) {
    try {
      const payload = { data: [{
        event_name: 'Schedule', event_time: Math.floor(Date.now() / 1000), event_id: 'cal_' + (p.uid || Date.now()),
        action_source: 'other',
        user_data: { em: sha256(att.email), ph: phone ? sha256(String(phone).replace(/\D/g, '')) : undefined },
        custom_data: { content_name: 'Videollamada Albaside' }
      }] };
      const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      resultado.push('meta ' + res.status);
    } catch (e) { resultado.push('meta error'); }
  }

  return { statusCode: 200, body: resultado.join(' · ') || 'sin configurar' };
};
