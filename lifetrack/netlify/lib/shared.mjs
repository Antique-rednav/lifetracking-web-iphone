import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function authOk(req) {
  const expected = process.env.APP_TOKEN || '';
  const got = req.headers.get('x-app-token') || '';
  if (!expected || !got) return false;
  const a = Buffer.from(expected), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const subsStore = () => getStore('subs');
export const keyOf = (endpoint) => createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 40);

let vapidReady = false;
export function initPush() {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  vapidReady = true;
  return true;
}
export { webpush };
