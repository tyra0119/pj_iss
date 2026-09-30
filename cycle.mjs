// シェアサイクルのポート（GBFS）。ポートの一覧は scripts/build-cycle.mjs が候補地・最寄駅の近くだけ data/cycle.json にまとめてある。
// 台数（station_status）は中継サーバ（https://tyra.jp/odpt/api/main/v4/gbfs/<システム>/station_status.json）から当日に取る
const BASE = 'https://tyra.jp/odpt/api/main/v4/gbfs';
let portsPromise = null;
const statusCache = new Map(); // sys -> { at, map }
let pausedUntil = 0;

export async function loadPorts(url = './data/cycle.json?v=51f8f22-1802') {
  if (!portsPromise) portsPromise = fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return portsPromise;
}

const dist = (a, b) => { const d = Math.PI / 180, R = 6371000; const dl = (b[0] - a[0]) * d, dn = (b[1] - a[1]) * d; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

/** 地点から maxM 以内のポートを近い順に */
export function portsNear(data, lat, lon, maxM = 500, limit = 3) {
  if (!data) return [];
  return data.ports
    .map((p) => ({ ...p, d: Math.round(dist([lat, lon], [p.lat, p.lon])) }))
    .filter((p) => p.d <= maxM)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

/** システムごとの台数。id → { bikes, docks, renting, returning, at }。取れなければ null（60 秒キャッシュ） */
export async function fetchStatus(sys) {
  const c = statusCache.get(sys);
  if (c && Date.now() - c.at < 60e3) return c.map;
  if (Date.now() < pausedUntil) return c?.map ?? null;
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(sys)}/station_status.json`);
    if (res.status === 429 || res.status === 503) { pausedUntil = Date.now() + (Number(res.headers.get('Retry-After')) || 60) * 1000; return c?.map ?? null; }
    if (!res.ok) return c?.map ?? null;
    const j = await res.json();
    const map = new Map();
    for (const s of j.data?.stations ?? []) map.set(String(s.station_id), { bikes: s.num_bikes_available ?? null, docks: s.num_docks_available ?? null, renting: s.is_renting !== false, returning: s.is_returning !== false, at: s.last_reported ?? null });
    statusCache.set(sys, { at: Date.now(), map });
    return map;
  } catch { return c?.map ?? null; }
}

/** ポートの配列に台数を付ける（システムごとにまとめて取る） */
export async function withStatus(ports) {
  const systems = [...new Set(ports.map((p) => p.sys))];
  const maps = Object.fromEntries(await Promise.all(systems.map(async (s) => [s, await fetchStatus(s)])));
  return ports.map((p) => ({ ...p, status: maps[p.sys]?.get(p.id) ?? null, statusKnown: !!maps[p.sys] }));
}
