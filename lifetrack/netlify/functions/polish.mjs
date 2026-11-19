import { json, authOk } from '../lib/shared.mjs';

export const config = { path: '/.netlify/functions/polish' };

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!authOk(req)) return json({ ok: false, error: 'Token salah' }, 401);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ ok: false, error: 'ANTHROPIC_API_KEY belum diatur' }, 501);
  let text = '';
  try { text = String((await req.json()).text || '').trim().slice(0, 300); } catch (e) {}
  if (!text) return json({ ok: false, error: 'Teks kosong' }, 400);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 120,
      system: 'Ubah teks menjadi satu goal harian yang spesifik dan bisa diselesaikan, bahasa Indonesia, maksimal 80 karakter. Balas hanya teks goal, tanpa tanda kutip atau penjelasan.',
      messages: [{ role: 'user', content: text }]
    })
  });
  if (!res.ok) return json({ ok: false, error: 'Gagal memanggil model (' + res.status + ')' }, 502);
  const data = await res.json();
  const out = (data.content && data.content[0] && data.content[0].text || '').trim().replace(/^["']|["']$/g, '');
  return json({ ok: true, text: out || text });
};
