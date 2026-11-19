// Logika murni: tentukan notifikasi apa yang harus dikirim sekarang untuk satu perangkat.
export const SLOT_MIN = 30; // cron berjalan tiap 30 menit
const DAY_START_HOUR = 6;

export function localParts(now, tz) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(now);
  } catch (e) {
    return localParts(now, 'Asia/Jakarta');
  }
  const o = {};
  parts.forEach((p) => { o[p.type] = p.value; });
  const date = `${o.year}-${o.month}-${o.day}`;
  const min = Number(o.hour) * 60 + Number(o.minute);
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
  return { date, min, dow };
}

function prevDate(ds) {
  const d = new Date(ds + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
export const activeDateOf = (lp) => (lp.min < DAY_START_HOUR * 60 ? prevDate(lp.date) : lp.date);

const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const inSlot = (nowMin, t) => { const tm = toMin(t); return tm != null && nowMin >= tm && nowMin < tm + SLOT_MIN; };
const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');

/** rec: {tz, prefs, summary, lastSent}. Return [{type,title,body,tag,key}] */
export function decide(rec, now = new Date()) {
  const out = [];
  const prefs = rec.prefs || {};
  const s = rec.summary || null;
  const lp = localParts(now, rec.tz || 'Asia/Jakarta');
  const active = activeDateOf(lp);
  const fresh = !!s && s.date === active;
  const last = rec.lastSent || {};
  const on = (id) => prefs[id] && prefs[id].on !== false;
  const due = (id, defTime) => on(id) && inSlot(lp.min, (prefs[id] && prefs[id].time) || defTime) && last[id] !== active;
  const add = (type, title, body, key) => out.push({ type, title, body, tag: type, key: key || active });

  if (due('morning', '08:00')) {
    if (fresh && s.goalsTotal > 0) add('morning', 'Selamat pagi', `${s.goalsTotal} goal hari ini${s.habitsTotal ? `, ${s.habitsTotal} kebiasaan` : ''}. Mulai dari yang paling penting.`);
    else add('morning', 'Selamat pagi', 'Belum ada goal hari ini. Tulis 3 hal yang ingin kamu selesaikan.');
  }
  if (due('bills', '09:00') && fresh && (s.billsTomorrow || []).length) {
    const b = s.billsTomorrow;
    add('bills', 'Tagihan besok', b.slice(0, 3).map((x) => `${x.name} ${rp(x.amount)}`).join(', ') + (b.length > 3 ? ` +${b.length - 3}` : ''));
  }
  if (due('weekly', '18:00') && lp.dow === 0) {
    const w = (fresh && s.weekly) || null;
    add('weekly', 'Review mingguan', w ? `Goal selesai ${w.goalsPct ?? 0}%, pengeluaran ${rp(w.spend || 0)}${w.sleepAvg != null ? `, tidur rata-rata ${w.sleepAvg} jam` : ''}.` : 'Saatnya review minggu ini.');
  }
  if (due('expense', '20:30') && fresh && !(s.txToday > 0)) add('expense', 'Catat pengeluaran', 'Hari ini belum ada catatan uang. Butuh 10 detik.');
  if (due('plan', '21:00') && fresh && !(s.tomorrowPlanned > 0)) add('plan', 'Rencanakan besok', 'Rencana besok masih kosong. Tulis 1–3 goal sebelum tidur.');
  if (due('streak', '21:30') && fresh && s.goalsTotal > 0 && s.goalsDone < s.goalsTotal) {
    const left = s.goalsTotal - s.goalsDone;
    add('streak', 'Streak terancam', `${left} goal belum selesai${s.streak ? `. Streak ${s.streak} hari dipertaruhkan` : ''}.`);
  }
  if (due('bed', '23:00')) add('bed', 'Waktunya tidur', 'Siapkan diri tidur supaya besok bertenaga.');

  // anggaran: tanpa jam; kirim saat jam aktif 10:00–21:00, sekali per kategori per tingkat (80/100) per hari
  if (on('budget') && fresh && lp.min >= 600 && lp.min < 1260) {
    for (const b of s.budget || []) {
      const tier = b.pct >= 100 ? 100 : 80;
      const key = `${active}:${b.cat}:${tier}`;
      if (last['budget:' + b.cat] === key) continue;
      add('budget', tier === 100 ? 'Anggaran habis' : 'Anggaran hampir habis', `${b.cat} sudah ${b.pct}% dari batas bulan ini.`, key);
      break; // satu per putaran agar tidak spam
    }
  }
  return out;
}

export function markSent(rec, n) {
  rec.lastSent = rec.lastSent || {};
  if (n.type === 'budget') rec.lastSent['budget:' + (n.body.split(' sudah')[0])] = n.key;
  else rec.lastSent[n.type] = n.key;
}
