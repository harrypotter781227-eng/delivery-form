// Vercel serverless function (goes in the api/ folder as api/submit.js).
// Receives the delivery form, validates it, and sends it to your Telegram chat.
//
// Secrets are read from environment variables, never written in code:
//   TELEGRAM_BOT_TOKEN  - the token from @BotFather
//   TELEGRAM_CHAT_ID    - your numeric chat ID

const crypto = require('crypto');

const STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang',
  'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor',
  'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya',
];

// Remove control characters, collapse whitespace, trim, cap the length.
const clean = (v, max) =>
  String(v == null ? '' : v)
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// +60 12-345 6789 / 60123456789 / 012-345 6789  ->  0123456789
function normalizePhone(raw) {
  let p = String(raw || '').replace(/[\s\-().]/g, '');
  if (p.startsWith('+60')) p = '0' + p.slice(3);
  else if (p.startsWith('60') && p.length >= 11) p = '0' + p.slice(2);
  return p;
}

function validate(b) {
  const d = {
    name: clean(b.name, 100),
    phone: normalizePhone(clean(b.phone, 25)),
    address1: clean(b.address1, 150),
    address2: clean(b.address2, 150),
    postcode: clean(b.postcode, 10),
    city: clean(b.city, 60),
    state: clean(b.state, 30),
    email: clean(b.email, 100),
    notes: clean(b.notes, 200),
  };
  const errors = {};
  if (d.name.length < 2) errors.name = 'Please enter your full name.';
  if (!/^01\d{8,9}$/.test(d.phone)) errors.phone = 'Enter a Malaysian mobile number, e.g. 012-3456789.';
  if (d.address1.length < 5) errors.address1 = 'Please enter your street address.';
  if (!/^\d{5}$/.test(d.postcode)) errors.postcode = 'Postcode must be 5 digits.';
  if (d.city.length < 2) errors.city = 'Please enter your city or town.';
  if (!STATES.includes(d.state)) errors.state = 'Please choose your state.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errors.email = 'That email looks incorrect.';
  const consent = b.consent === true || b.consent === 'true' || b.consent === 'on';
  if (!consent) errors.consent = 'Please tick the box to continue.';
  return { d, errors };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Text inside <code> can be copied with one tap in Telegram.
const code = (s) => `<code>${esc(s)}</code>`;

function makeRef() {
  const myDate = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(2, 10).replace(/-/g, '');
  return `JT-${myDate}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function buildMessage(ref, d) {
  const address = [d.address1, d.address2].filter(Boolean).join(', ');
  const when = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const lines = [
    `📦 <b>New order ${esc(ref)}</b>`,
    '',
    `Name: ${code(d.name)}`,
    `Phone: ${code(d.phone)}`,
    `Address: ${code(address)}`,
    `Postcode: ${code(d.postcode)}`,
    `City: ${code(d.city)}`,
    `State: ${code(d.state)}`,
  ];
  if (d.email) lines.push(`Email: ${code(d.email)}`);
  if (d.notes) lines.push(`Notes: ${esc(d.notes)}`);
  lines.push('', `🕒 ${esc(when)}`);
  return lines.join('\n');
}

async function sendToTelegram(token, chatId, text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      let desc = '';
      try { desc = (await r.json()).description || ''; } catch (_) { /* ignore */ }
      throw new Error(`Telegram responded ${r.status} ${desc}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.');
    return res.status(500).json({ ok: false, error: 'The order form is not set up yet.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  // Spam traps: the hidden "website" field must be empty, and a real person
  // needs more than 3 seconds to fill in the form. Bots get a fake "success".
  const elapsed = Number(body.elapsed);
  if (body.website || !(elapsed >= 3000)) {
    return res.status(200).json({ ok: true, ref: makeRef() });
  }

  const { d, errors } = validate(body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, error: 'Please check the highlighted fields.', errors });
  }

  const ref = makeRef();
  try {
    await sendToTelegram(token, chatId, buildMessage(ref, d));
  } catch (err) {
    console.error('Telegram send failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Could not send your details. Please try again in a moment.' });
  }

  return res.status(200).json({ ok: true, ref });
};

// Exposed for local testing only; Vercel ignores extra properties.
module.exports._test = { validate, normalizePhone, buildMessage };
