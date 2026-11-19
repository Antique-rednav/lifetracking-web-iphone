import { json, authOk, subsStore, keyOf, initPush, webpush } from '../lib/shared.mjs';

export const config = { path: '/.netlify/functions/api' };

const clean = (v, max = 4000) => JSON.stringify(v ?? null).length > max ? null : v;

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!authOk(req)) return json({ ok: false, error: 'Token salah atau belum diatur di server (APP_TOKEN).' }, 401);

  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, error: 'JSON tidak valid' }, 400); }
  const store = subsStore();

  switch (body.action) {
    case 'config':
      return json({ ok: true, publicKey: process.env.VAPID_PUBLIC_KEY || '' });

    case 'subscribe': {
      const sub = body.subscription;
      if (!sub || !sub.endpoint || !sub.keys) return json({ ok: false, error: 'Subscription tidak valid' }, 400);
      const key = keyOf(sub.endpoint);
      const old = (await store.get(key, { type: 'json' })) || {};
      await store.setJSON(key, {
        subscription: sub,
        tz: String(body.tz || 'Asia/Jakarta').slice(0, 64),
        prefs: clean(body.prefs) || old.prefs || {},
        summary: clean(body.summary) || old.summary || null,
        lastSent: old.lastSent || {},
        createdAt: old.createdAt || Date.now(),
        updatedAt: Date.now()
      });
      return json({ ok: true });
    }

    case 'sync': {
      const key = keyOf(body.endpoint);
      const rec = await store.get(key, { type: 'json' });
      if (!rec) return json({ ok: false, error: 'Perangkat belum terdaftar' }, 404);
      if (body.tz) rec.tz = String(body.tz).slice(0, 64);
      if (body.prefs) rec.prefs = clean(body.prefs) || rec.prefs;
      if (body.summary) rec.summary = clean(body.summary) || rec.summary;
      rec.updatedAt = Date.now();
      await store.setJSON(key, rec);
      return json({ ok: true });
    }

    case 'unsubscribe':
      await store.delete(keyOf(body.endpoint));
      return json({ ok: true });

    case 'test': {
      if (!initPush()) return json({ ok: false, error: 'VAPID key belum diatur di server.' }, 500);
      const rec = await store.get(keyOf(body.endpoint), { type: 'json' });
      if (!rec) return json({ ok: false, error: 'Perangkat belum terdaftar' }, 404);
      try {
        await webpush.sendNotification(rec.subscription, JSON.stringify({ title: 'Tes notifikasi', body: 'Push berfungsi. Kamu akan menerima pengingat di sini.', tag: 'test' }));
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await store.delete(keyOf(body.endpoint));
        return json({ ok: false, error: 'Gagal kirim: ' + (e.statusCode || e.message) }, 502);
      }
      return json({ ok: true });
    }

    default:
      return json({ ok: false, error: 'Aksi tidak dikenal' }, 400);
  }
};
