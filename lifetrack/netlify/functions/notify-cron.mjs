import { subsStore, initPush, webpush } from '../lib/shared.mjs';
import { decide, markSent } from '../lib/notify-logic.mjs';

// UTC. WIB = UTC+7 → 00:00–16:30 UTC = 07:00–23:30 WIB. Tiap 30 menit.
export const config = { schedule: '*/30 0-16 * * *' };

export default async () => {
  if (!initPush()) { console.log('VAPID belum diatur'); return; }
  const store = subsStore();
  const { blobs } = await store.list();
  const now = new Date();
  let sent = 0;
  for (const { key } of blobs) {
    const rec = await store.get(key, { type: 'json' });
    if (!rec || !rec.subscription) continue;
    const todo = decide(rec, now);
    if (!todo.length) continue;
    let dirty = false, gone = false;
    for (const n of todo) {
      try {
        await webpush.sendNotification(rec.subscription, JSON.stringify({ title: n.title, body: n.body, tag: n.tag }));
        markSent(rec, n); dirty = true; sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { gone = true; break; }
        console.log('push gagal', e.statusCode || e.message);
      }
    }
    if (gone) await store.delete(key);
    else if (dirty) await store.setJSON(key, rec);
  }
  console.log('notif terkirim:', sent);
};
