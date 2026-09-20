// data/transit.json（ODPT から生成した駅グラフ）で経路と所要時間、始発・終電を求める
// ブラウザ／Node 両用

export const TRANSIT_PARAMS = {
  boardWaitMin: 4,        // 乗車ごとの待ち（平均）
  walkKmh: 4.8,           // 徒歩速度
  maxAccessKm: 1.5,       // 出発地から最寄駅までの上限
};

const kmBetween = (a, b) => { const d = Math.PI / 180, R = 6371; const dl = (b.lat - a.lat) * d, dn = (b.lon - a.lon) * d; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

export class Transit {
  constructor(data) {
    this.data = data;
    this.railwayById = new Map(data.railways.map((r) => [r.id, r]));
    this.adj = data.stations.map(() => []);
    for (const [a, b, m] of data.edges) { this.adj[a].push({ to: b, min: m, rail: true }); this.adj[b].push({ to: a, min: m, rail: true }); }
    for (const [a, b, m] of data.transfers) { this.adj[a].push({ to: b, min: m, rail: false }); this.adj[b].push({ to: a, min: m, rail: false }); }
    this.stationIndexByRailway = new Map(); // railwayId -> Map(stationIdx -> order)
    // 駅順は edges の並びから復元（build 時に路線順で書いている）
    const orderPos = new Map();
    for (const [a, b] of data.edges) {
      const r = data.stations[a].r;
      const m = this.stationIndexByRailway.get(r) ?? this.stationIndexByRailway.set(r, new Map()).get(r);
      if (!m.has(a)) m.set(a, m.size);
      if (!m.has(b)) m.set(b, m.size);
    }
    void orderPos;
  }

  /** 名前（と任意の路線名の一部）で駅候補を探す */
  findStations(name, lineHint) {
    const list = this.data.stations.map((s, i) => ({ s, i })).filter(({ s }) => s.n === name);
    if (!list.length) return [];
    if (lineHint) {
      const hinted = list.filter(({ s }) => (this.railwayById.get(s.r)?.n ?? '').includes(lineHint));
      if (hinted.length) return hinted.map((x) => x.i);
    }
    return list.map((x) => x.i);
  }

  /** 地点から歩ける駅（距離順、最大 n 件） */
  nearestStations(pt, n = 6, maxKm = TRANSIT_PARAMS.maxAccessKm) {
    const arr = this.data.stations.map((s, i) => ({ i, d: kmBetween(pt, s) })).filter((x) => x.d <= maxKm).sort((a, b) => a.d - b.d);
    return arr.slice(0, n);
  }

  /**
   * ダイクストラ。複数の出発駅（初期コスト付き）から複数の到着駅へ。
   * 乗車開始（徒歩→鉄道、乗換後）ごとに待ち時間を足す。
   */
  route(fromList, toSet) {
    const N = this.data.stations.length;
    // 状態: 駅 × 「今どの路線に乗っているか（-1: 乗っていない）」を簡略化して駅のみで扱い、
    // 乗換エッジ通過時に待ちを加算する
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const prevEdge = new Array(N).fill(null);
    const heap = [];
    const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (const { i, cost } of fromList) { if (cost < dist[i]) { dist[i] = cost + TRANSIT_PARAMS.boardWaitMin; push(dist[i], i); } }
    const done = new Uint8Array(N);
    let best = null;
    while (heap.length) {
      const [d, i] = pop();
      if (done[i]) continue;
      done[i] = 1;
      if (toSet.has(i)) { best = i; break; }
      for (const e of this.adj[i]) {
        const nd = d + e.min + (e.rail ? 0 : TRANSIT_PARAMS.boardWaitMin);
        if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = i; prevEdge[e.to] = e; push(nd, e.to); }
      }
    }
    if (best == null) return null;
    // 経路復元 → 区間（路線ごと）にまとめる
    const path = [];
    for (let i = best; i !== -1; i = prev[i]) path.unshift(i);
    const legs = [];
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      const e = prevEdge[b];
      const s = this.data.stations;
      if (!e.rail) { legs.push({ type: 'transfer', from: a, to: b, min: e.min }); continue; }
      const last = legs[legs.length - 1];
      if (last && last.type === 'rail' && last.railway === s[a].r && last.to === a) { last.to = b; last.min += e.min; last.stops++; }
      else legs.push({ type: 'rail', railway: s[a].r, from: a, to: b, min: e.min, stops: 1 });
    }
    return { totalMin: dist[best], from: path[0], to: best, legs };
  }

  /** 区間の進行方向の符号（駅順 index が増える向きなら '+'） */
  legSign(leg) {
    const m = this.stationIndexByRailway.get(leg.railway);
    if (!m) return null;
    const a = m.get(leg.from), b = m.get(leg.to);
    if (a == null || b == null) return null;
    return b > a ? '+' : '-';
  }

  /** 駅 idx から路線 railway・符号 sign の始発・終電 [firstMin, lastMin]（当日の分。24:10 は 1450） */
  firstLast(stationIdx, railway, sign, holiday) {
    const slot = this.data.fl?.[stationIdx]?.[railway]?.[sign];
    if (!slot) return null;
    return slot[holiday ? 'hd' : 'wd'] ?? slot.wd ?? slot.hd ?? null;
  }

  /**
   * 出発地点 → 目的地点 の所要と経路。徒歩アクセスも含む。
   * from/to: {lat, lon} または {stationIdx[]}
   */
  plan(from, to) {
    const walkMin = (kmv) => (kmv / TRANSIT_PARAMS.walkKmh) * 60;
    const fromList = from.stationIdx ? from.stationIdx.map((i) => ({ i, cost: from.accessMin ?? 0 }))
      : this.nearestStations(from).map(({ i, d }) => ({ i, cost: walkMin(d) + 3 }));
    const toList = to.stationIdx ? to.stationIdx.map((i) => ({ i, cost: to.accessMin ?? 0 }))
      : this.nearestStations(to).map(({ i, d }) => ({ i, cost: walkMin(d) }));
    if (!fromList.length || !toList.length) return null;
    // 到着側の徒歩は駅ごとに違うので、候補ごとに解いて最小を取る
    let best = null;
    for (const t of toList) {
      const r = this.route(fromList, new Set([t.i]));
      if (!r) continue;
      const total = r.totalMin + t.cost;
      if (!best || total < best.totalMin) best = { ...r, totalMin: total, accessFromMin: fromList.find((f) => f.i === r.from)?.cost ?? 0, accessToMin: t.cost };
    }
    return best;
  }

  describeLegs(plan) {
    const s = this.data.stations;
    return plan.legs.filter((l) => l.type === 'rail').map((l) => `${this.railwayById.get(l.railway)?.n ?? l.railway} ${s[l.from].n}→${s[l.to].n}（${Math.round(l.min)}分）`);
  }
}

export async function loadTransit(url = './data/transit.json?v=520b9e5-0920') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`transit data ${res.status}`);
  return new Transit(await res.json());
}
