// 都営バスの現在位置（GTFS-RT VehiclePosition）。中継サーバ経由（https://tyra.jp/odpt/api/main/v4/gtfs/realtime/ToeiBus）
// protobuf の最小デコーダを自前で持つ（依存なし）。読むのは FeedMessage → FeedEntity → VehiclePosition の
// trip.trip_id / position.latitude, longitude / current_status / stop_id / timestamp だけ
//
// trip_id は "04601-2-85-179-1744" の形で、先頭の 5 桁と 2 番目が ODPT の BusroutePattern ID
// （odpt.BusroutePattern:Toei.NM01.4601.2）の系統コードと方向に一致し、末尾 4 桁は始発停留所の発車時刻（HHMM）。
// stop_id "2327-02" は ODPT の BusstopPole ID（odpt.BusstopPole:Toei.TelecomCenterStation.2327.2）の番号に一致する（2026-09-30 確認）

const URL = 'https://tyra.jp/odpt/api/main/v4/gtfs/realtime/ToeiBus';
let cache = { at: 0, data: null };
let pausedUntil = 0;

function decode(buf, off = 0, end = buf.length) {
  const out = [];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  while (off < end) {
    let key = 0, shift = 0, b;
    do { b = buf[off++]; key |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
    const field = key >>> 3, wt = key & 7;
    if (wt === 0) { let v = 0, m = 1; do { b = buf[off++]; v += (b & 0x7f) * m; m *= 128; } while (b & 0x80); out.push([field, v]); }
    else if (wt === 1) { out.push([field, dv.getFloat64(off, true)]); off += 8; }
    else if (wt === 5) { out.push([field, dv.getFloat32(off, true)]); off += 4; }
    else if (wt === 2) { let len = 0, s = 0; do { b = buf[off++]; len |= (b & 0x7f) << s; s += 7; } while (b & 0x80); out.push([field, buf.subarray(off, off + len)]); off += len; }
    else throw new Error('unsupported wire type ' + wt);
  }
  return out;
}
const str = (u8) => new TextDecoder().decode(u8);
const get = (fields, n) => fields.find((f) => f[0] === n)?.[1];

/** 車両の一覧。取れなければ null（30 秒キャッシュ。429 のあとは Retry-After の間は呼ばない） */
export async function fetchToeiVehicles() {
  if (cache.data && Date.now() - cache.at < 30e3) return cache.data;
  if (Date.now() < pausedUntil) return cache.data;
  try {
    const res = await fetch(URL);
    if (res.status === 429 || res.status === 503) { pausedUntil = Date.now() + (Number(res.headers.get('Retry-After')) || 60) * 1000; return cache.data; }
    if (!res.ok) return cache.data;
    const buf = new Uint8Array(await res.arrayBuffer());
    const msg = decode(buf);
    const header = decode(get(msg, 1) ?? new Uint8Array());
    const feedTs = get(header, 3) ?? null;
    const list = [];
    for (const e of msg.filter((f) => f[0] === 2)) {
      const fe = decode(e[1]);
      const vp = get(fe, 4);
      if (!vp) continue;
      const v = decode(vp);
      const trip = get(v, 1) ? decode(get(v, 1)) : [];
      const tripId = get(trip, 1) ? str(get(trip, 1)) : '';
      const pos = get(v, 2) ? decode(get(v, 2)) : [];
      const m = tripId.match(/^(\d+)-(\d+)-\d+-\d+-(\d{4})$/);
      list.push({
        tripId,
        code: m ? Number(m[1]) : null,      // 系統コード（ODPT パターン ID の数字部分）
        dir: m ? m[2] : null,               // 方向
        dep: m ? `${m[3].slice(0, 2)}:${m[3].slice(2)}` : null, // 始発停留所の発車時刻
        lat: get(pos, 1) ?? null, lon: get(pos, 2) ?? null,
        seq: get(v, 3) ?? null,             // 何番目の停留所か（GTFS 側の番号）
        status: get(v, 4) ?? 2,             // 0 まもなく到着, 1 停車中, 2 走行中（次の停留所へ）
        stopKey: get(v, 7) ? str(get(v, 7)).replace(/^0+/, '').replace(/-0*/, '-') : null, // "2327-2"
        ts: get(v, 5) ?? null,
      });
    }
    cache = { at: Date.now(), data: { feedTs, vehicles: list } };
    return cache.data;
  } catch { return cache.data; }
}

/** ODPT の pole ID（odpt.BusstopPole:Toei.Xxx.2327.2）→ GTFS-RT の stop キー "2327-2" */
export const poleKey = (poleId) => { const m = String(poleId).match(/\.(\d+)\.(\d+)$/); return m ? `${Number(m[1])}-${Number(m[2])}` : null; };
/** ODPT のパターン ID（odpt.BusroutePattern:Toei.NM01.4601.2）→ { code: 4601, dir: '2' } */
export const patternKey = (patternId) => { const m = String(patternId).match(/\.(\d+)\.(\d+)$/); return m ? { code: Number(m[1]), dir: m[2] } : null; };

/**
 * ある系統パターンを走っている車両を、乗る停留所との位置関係つきで返す
 * @param {{id:string, stops:number[]}} pattern  ODPT のパターン（stops は pole の index）
 * @param {(poleIdx:number)=>string} poleIdOf     pole index → ODPT pole ID
 * @param {number} boardIdx                       乗る停留所（pattern.stops の中での位置）
 */
export function busesOnPattern(feed, pattern, poleIdOf, boardIdx) {
  if (!feed || !pattern) return [];
  const pk = patternKey(pattern.id);
  if (!pk) return [];
  const keys = pattern.stops.map((i) => poleKey(poleIdOf(i)));
  return feed.vehicles
    .filter((v) => v.code === pk.code && v.dir === pk.dir)
    .map((v) => {
      const at = v.stopKey ? keys.indexOf(v.stopKey) : -1;
      return { ...v, stopIdx: at, before: at >= 0 ? boardIdx - at : null };
    })
    .sort((a, b) => (a.before ?? 99) - (b.before ?? 99));
}
