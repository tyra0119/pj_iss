// data/transit.json（鉄道の駅グラフ）と data/bus.json（バス停・路線パターン）で経路と所要時間、始発・終電を求める
// ブラウザ／Node 両用

export const TRANSIT_PARAMS = {
  boardWaitMin: 4,        // 鉄道: 乗車ごとの待ち（平均）
  busWaitMin: 9,          // バス: 乗車ごとの待ち（平均。本数が少ないので長め）
  busPenaltyMin: 3,       // バスは遅れやすいので少し不利にする
  walkKmh: 4.8,           // 徒歩速度
  maxAccessKm: 1.5,       // 出発地から最寄駅までの上限
  busStopAccessKm: 0.6,   // 出発地・目的地からバス停までの上限
  transferWalkKm: 0.25,   // 駅とバス停の乗換とみなす距離
};

const kmBetween = (a, b) => { const d = Math.PI / 180, R = 6371; const dl = (b.lat - a.lat) * d, dn = (b.lon - a.lon) * d; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

export class Transit {
  /**
   * @param {object} data 鉄道グラフ
   * @param {object|null} bus バスグラフ（無ければ鉄道のみ）
   */
  constructor(data, bus = null) {
    this.data = data;
    this.bus = bus;
    this.railwayById = new Map(data.railways.map((r) => [r.id, r]));
    const nRail = data.stations.length;
    this.nRail = nRail;
    // ノード: 0..nRail-1 が駅、それ以降がバス停
    this.nodes = data.stations.map((s) => ({ n: s.n, lat: s.lat, lon: s.lon, mode: 'rail', line: s.r }));
    if (bus) for (const p of bus.poles) this.nodes.push({ n: p.n, lat: p.lat, lon: p.lon, mode: 'bus', op: p.op, id: p.id });
    this.adj = this.nodes.map(() => []);
    for (const [a, b, m] of data.edges) { this.adj[a].push({ to: b, min: m, mode: 'rail' }); this.adj[b].push({ to: a, min: m, mode: 'rail' }); }
    for (const [a, b, m] of data.transfers) { this.adj[a].push({ to: b, min: m, mode: 'walk' }); this.adj[b].push({ to: a, min: m, mode: 'walk' }); }
    if (bus) {
      // バスは片方向
      for (const [a, b, m, pi] of bus.edges) this.adj[nRail + a].push({ to: nRail + b, min: m + 0, mode: 'bus', pattern: pi });
      this._buildBusTransfers();
    }
    this.stationIndexByRailway = new Map(); // railwayId -> Map(stationIdx -> order)
    for (const [a, b] of data.edges) {
      const r = data.stations[a].r;
      const m = this.stationIndexByRailway.get(r) ?? this.stationIndexByRailway.set(r, new Map()).get(r);
      if (!m.has(a)) m.set(a, m.size);
      if (!m.has(b)) m.set(b, m.size);
    }
  }

  /** 駅⇔バス停、バス停⇔バス停（同名・近接）の徒歩エッジ */
  _buildBusTransfers() {
    const cell = (lat, lon) => `${Math.floor(lat / 0.004)}|${Math.floor(lon / 0.004)}`;
    const grid = new Map();
    this.nodes.forEach((n, i) => { const k = cell(n.lat, n.lon); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); });
    const walkMin = (kmv) => Math.round((kmv / TRANSIT_PARAMS.walkKmh) * 60 + 1);
    const seen = new Set();
    for (let i = this.nRail; i < this.nodes.length; i++) {
      const a = this.nodes[i];
      const [gy, gx] = cell(a.lat, a.lon).split('|').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const j of grid.get(`${gy + dy}|${gx + dx}`) ?? []) {
        if (j === i) continue;
        const b = this.nodes[j];
        const d = kmBetween(a, b);
        if (b.mode === 'rail') {
          if (d > TRANSIT_PARAMS.transferWalkKm) continue;
        } else {
          // バス停同士は同名なら 200 m、別名なら 120 m 以内
          if (d > (a.n === b.n ? 0.2 : 0.12)) continue;
        }
        const key = i < j ? `${i}|${j}` : `${j}|${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const m = walkMin(d) + 2;
        this.adj[i].push({ to: j, min: m, mode: 'walk' });
        this.adj[j].push({ to: i, min: m, mode: 'walk' });
      }
    }
  }

  /** 名前（と任意の路線名の一部）で駅候補を探す（駅のみ） */
  findStations(name, lineHint) {
    const list = this.data.stations.map((s, i) => ({ s, i })).filter(({ s }) => s.n === name);
    if (!list.length) return [];
    if (lineHint) {
      const hinted = list.filter(({ s }) => (this.railwayById.get(s.r)?.n ?? '').includes(lineHint));
      if (hinted.length) return hinted.map((x) => x.i);
    }
    return list.map((x) => x.i);
  }

  /** 地点から歩ける駅・バス停（距離順） */
  nearestNodes(pt, { rail = 6, bus = 6 } = {}) {
    const out = [];
    const r = [], b = [];
    this.nodes.forEach((n, i) => {
      const d = kmBetween(pt, n);
      if (n.mode === 'rail') { if (d <= TRANSIT_PARAMS.maxAccessKm) r.push({ i, d }); }
      else if (d <= TRANSIT_PARAMS.busStopAccessKm) b.push({ i, d });
    });
    r.sort((x, y) => x.d - y.d); b.sort((x, y) => x.d - y.d);
    out.push(...r.slice(0, rail), ...b.slice(0, bus));
    return out;
  }
  nearestStations(pt, n = 6) { return this.nearestNodes(pt, { rail: n, bus: 0 }); }

  /**
   * ダイクストラ。状態は「ノード × 乗っている系統（鉄道路線 / バスのパターン / なし）」を簡略化し、
   * 乗り物に乗り始めるとき（徒歩→乗り物、別系統へ）に待ち時間を足す。
   */
  route(fromList, toSet) {
    const N = this.nodes.length;
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const prevEdge = new Array(N).fill(null);
    const arrivedBy = new Array(N).fill(null); // 到達に使ったエッジの mode/系統
    const heap = [];
    const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (const { i, cost } of fromList) { if (cost < dist[i]) { dist[i] = cost; prev[i] = -1; arrivedBy[i] = { mode: 'walk' }; push(dist[i], i); } }
    const done = new Uint8Array(N);
    let best = null;
    while (heap.length) {
      const [d, i] = pop();
      if (done[i]) continue;
      done[i] = 1;
      if (toSet.has(i)) { best = i; break; }
      const cur = arrivedBy[i];
      for (const e of this.adj[i]) {
        let wait = 0;
        if (e.mode === 'rail') {
          const line = this.nodes[i].line;
          if (!(cur.mode === 'rail' && cur.key === line)) wait = TRANSIT_PARAMS.boardWaitMin;
        } else if (e.mode === 'bus') {
          if (!(cur.mode === 'bus' && cur.key === e.pattern)) wait = TRANSIT_PARAMS.busWaitMin + TRANSIT_PARAMS.busPenaltyMin;
        }
        const nd = d + e.min + wait;
        if (nd < dist[e.to]) {
          dist[e.to] = nd; prev[e.to] = i; prevEdge[e.to] = e;
          arrivedBy[e.to] = e.mode === 'rail' ? { mode: 'rail', key: this.nodes[i].line } : e.mode === 'bus' ? { mode: 'bus', key: e.pattern } : { mode: 'walk' };
          push(nd, e.to);
        }
      }
    }
    if (best == null) return null;
    const path = [];
    for (let i = best; i !== -1; i = prev[i]) path.unshift(i);
    const legs = [];
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      const e = prevEdge[b];
      const last = legs[legs.length - 1];
      if (e.mode === 'walk') {
        // 連続する徒歩（駅→バス停→駅 など）は 1 つの乗り換えにまとめる
        if (last && last.type === 'transfer' && last.to === a) { last.to = b; last.min += e.min; }
        else legs.push({ type: 'transfer', from: a, to: b, min: e.min });
        continue;
      }
      if (e.mode === 'rail') {
        const rw = this.data.stations[a].r;
        if (last && last.type === 'rail' && last.railway === rw && last.to === a) { last.to = b; last.min += e.min; last.stops++; }
        else legs.push({ type: 'rail', railway: rw, from: a, to: b, min: e.min, stops: 1 });
      } else {
        if (last && last.type === 'bus' && last.pattern === e.pattern && last.to === a) { last.to = b; last.min += e.min; last.stops++; }
        else legs.push({ type: 'bus', pattern: e.pattern, from: a, to: b, min: e.min, stops: 1 });
      }
    }
    return { totalMin: dist[best], from: path[0], to: best, legs };
  }

  legSign(leg) {
    if (leg.type !== 'rail') return null;
    const m = this.stationIndexByRailway.get(leg.railway);
    if (!m) return null;
    const a = m.get(leg.from), b = m.get(leg.to);
    if (a == null || b == null) return null;
    return b > a ? '+' : '-';
  }

  firstLast(stationIdx, railway, sign, holiday) {
    const slot = this.data.fl?.[stationIdx]?.[railway]?.[sign];
    if (!slot) return null;
    return slot[holiday ? 'hd' : 'wd'] ?? slot.wd ?? slot.hd ?? null;
  }

  /** バスのパターン情報 */
  busPattern(pi) { return this.bus?.patterns[pi] ?? null; }
  busOperatorJa(op) { return this.bus?.operators?.[op] ?? op; }
  /** バス停ノード idx → poles の id */
  poleId(nodeIdx) { return this.nodes[nodeIdx]?.id ?? null; }

  /**
   * 出発地点 → 目的地点 の所要と経路。徒歩アクセスも含む。
   * from/to: {lat, lon} または {stationIdx[], accessMin}
   * 目的地に lat/lon があればバス停からの徒歩も候補に入れる
   */
  plan(from, to, { allowBus = true } = {}) {
    const walkMin = (kmv) => (kmv / TRANSIT_PARAMS.walkKmh) * 60;
    const nearest = (pt) => (allowBus && this.bus ? this.nearestNodes(pt) : this.nearestStations(pt));
    let fromList;
    if (from.stationIdx) {
      fromList = from.stationIdx.map((i) => ({ i, cost: from.accessMin ?? 0 }));
      // 出発駅の近くのバス停からも乗れる
      if (allowBus && this.bus && from.lat != null) for (const { i, d } of this.nearestNodes(from, { rail: 0, bus: 4 })) fromList.push({ i, cost: (from.accessMin ?? 0) + walkMin(d) });
    } else fromList = nearest(from).map(({ i, d }) => ({ i, cost: walkMin(d) + 3 }));
    let toList;
    if (to.stationIdx) {
      toList = to.stationIdx.map((i) => ({ i, cost: to.accessMin ?? 0 }));
      if (allowBus && this.bus && to.lat != null) for (const { i, d } of this.nearestNodes(to, { rail: 0, bus: 4 })) toList.push({ i, cost: walkMin(d) });
    } else toList = nearest(to).map(({ i, d }) => ({ i, cost: walkMin(d) }));
    if (!fromList.length || !toList.length) return null;
    // 到着側は候補ごとにコストが違うので、ゴール集合をまとめて解き、到着コストを足して最小を選ぶ
    const toCost = new Map(toList.map((t) => [t.i, t.cost]));
    let best = null;
    // 単純化: 各ゴール候補について個別に解く（候補は最大 10 件）
    for (const t of toList.slice(0, 10)) {
      const r = this.route(fromList, new Set([t.i]));
      if (!r) continue;
      const total = r.totalMin + t.cost;
      if (!best || total < best.totalMin) best = { ...r, totalMin: total, accessFromMin: fromList.find((f) => f.i === r.from)?.cost ?? 0, accessToMin: t.cost };
    }
    void toCost;
    return best;
  }

  describeLegs(plan) {
    return plan.legs.filter((l) => l.type !== 'transfer').map((l) => l.type === 'rail'
      ? `${this.railwayById.get(l.railway)?.n ?? l.railway} ${this.nodes[l.from].n}→${this.nodes[l.to].n}（${Math.round(l.min)}分）`
      : `${this.busOperatorJa(this.busPattern(l.pattern)?.op)} ${this.busPattern(l.pattern)?.n ?? ''} ${this.nodes[l.from].n}→${this.nodes[l.to].n}（${Math.round(l.min)}分）`);
  }
}

export async function loadTransit(url = './data/transit.json?v=f9463a6-1315', busUrl = './data/bus.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`transit data ${res.status}`);
  const data = await res.json();
  let bus = null;
  try { const b = await fetch(busUrl); if (b.ok) bus = await b.json(); } catch { bus = null; }
  return new Transit(data, bus);
}
