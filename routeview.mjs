// 経路を縦のタイムラインで描く（遅延レーダーの「目的地への行き方」と同じ見た目）
// 駅・バス停のドット、路線色の縦線、区間ごとの説明と運行状態のバッジ
import { LINE_COLORS, OPERATOR_COLORS } from './linecolors.mjs?v=0e71034-1327';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (m) => { if (m == null || !Number.isFinite(m)) return ''; const h = Math.floor(m / 60), mm = String(Math.round(m % 60)).padStart(2, '0'); return h >= 24 ? `翌${h - 24}:${mm}` : `${h}:${mm}`; };

export function lineColor(railwayId, operatorId) {
  if (railwayId && LINE_COLORS[railwayId]) return LINE_COLORS[railwayId];
  const op = (railwayId ?? operatorId ?? '').replace(/^odpt\.(Railway|Operator):/, '').split('.')[0];
  return OPERATOR_COLORS[op] ?? '#8b94ad';
}

/**
 * @param {object} p
 * @param {object} p.transit Transit
 * @param {object} p.route plan() の戻り値（legs, from, to, accessFromMin, accessToMin）
 * @param {number|null} p.startMin 経路の乗り物に乗る時刻（分, その日の 0:00 起点）。null なら時刻を出さない
 * @param {string} p.originLabel 出発地の名前（例: 朝霞駅、光が丘公園）
 * @param {string} p.destLabel 目的地の名前
 * @param {Map<string,{level:string,text:string}>|null} p.status 路線ID→運行状態（当日のみ）
 * @param {(leg)=>string} p.direction 区間の方面表示
 * @param {number} p.waitRail 鉄道の乗車待ち（分）, p.waitBus バスの乗車待ち
 */
export function routeTimelineHtml(p) {
  const { transit: t, route, startMin, originLabel, destLabel, status, direction } = p;
  const waitRail = p.waitRail ?? 4, waitBus = p.waitBus ?? 12;
  const nodes = t.nodes;
  const label = (i) => `${esc(nodes[i].n)}${nodes[i].mode === 'bus' ? '<span class="rt-kind">バス停</span>' : '<span class="rt-kind">駅</span>'}`;
  let tm = startMin; // 現在時刻（分）。null なら非表示
  const rows = [];
  // 出発地 → 最初の乗り場
  const access = Math.round(route.accessFromMin ?? 0);
  rows.push(`<li class="rt-node rt-origin"><span class="rt-dot"></span><div class="rt-body"><div class="rt-name">${esc(originLabel)}</div>${tm != null ? `<div class="rt-time">${fmt(tm - access)} 出発</div>` : ''}</div></li>`);
  if (access > 0) rows.push(`<li class="rt-leg rt-walk"><span class="rt-bar"></span><div class="rt-body"><div class="rt-line">徒歩 約${access}分</div></div></li>`);
  rows.push(`<li class="rt-node"><span class="rt-dot"></span><div class="rt-body"><div class="rt-name">${label(route.from)}</div>${tm != null ? `<div class="rt-time">${fmt(tm)} 発</div>` : ''}</div></li>`);
  let boarded = null; // 乗っている系統（連続乗車の判定）
  let stationsTotal = 0, transfers = 0;
  for (let k = 0; k < route.legs.length; k++) {
    const leg = route.legs[k];
    if (leg.type === 'transfer') {
      const same = nodes[leg.from].n === nodes[leg.to].n;
      transfers++;
      rows.push(`<li class="rt-leg rt-walk"><span class="rt-bar"></span><div class="rt-body"><div class="rt-line">乗り換え${same ? '' : `・${label(leg.to)}へ`} 徒歩 約${Math.round(leg.min)}分</div></div></li>`);
      if (tm != null) tm += leg.min;
      if (!same) rows.push(`<li class="rt-node"><span class="rt-dot"></span><div class="rt-body"><div class="rt-name">${label(leg.to)}</div></div></li>`);
      boarded = null;
      continue;
    }
    const isBus = leg.type === 'bus';
    const key = isBus ? `bus:${leg.pattern}` : `rail:${leg.railway}`;
    const wait = boarded === key ? 0 : (isBus ? waitBus : waitRail);
    if (tm != null && wait) tm += wait;
    const pat = isBus ? t.busPattern(leg.pattern) : null;
    const name = isBus ? `${t.busOperatorJa(pat?.op)} ${pat?.n ?? ''}` : (t.railwayById.get(leg.railway)?.n ?? leg.railway);
    const color = isBus ? (OPERATOR_COLORS[pat?.op] ?? '#2e8b57') : (t.railwayById.get(leg.railway)?.c || lineColor(leg.railway));
    const dir = direction ? direction(leg) : '';
    const st = !isBus && status ? status.get(leg.railway) : null;
    const badge = st ? `<span class="rt-badge ${st.level === 'delayed' ? 'ng' : st.level === 'notice' ? 'warn' : 'ok'}">${st.level === 'delayed' ? '遅れあり' : st.level === 'notice' ? 'お知らせ' : '平常運転'}</span>` : '';
    const dep = tm;
    if (tm != null) tm += leg.min;
    stationsTotal += leg.stops;
    rows.push(`<li class="rt-leg ${isBus ? 'rt-bus' : 'rt-rail'}" style="--c:${color}"><span class="rt-bar"></span><div class="rt-body">
      <div class="rt-line"><span class="rt-swatch"></span><strong>${esc(name)}</strong>${dir ? ` <span class="rt-dir">${esc(dir)}</span>` : ''} ${badge}</div>
      <div class="rt-sub">${leg.stops}${isBus ? '停留所' : '駅'}・約${Math.round(leg.min)}分${tm != null ? `（${fmt(dep)} → ${fmt(tm)}）` : ''}・<strong>${esc(nodes[leg.to].n)}</strong>で降りる${isBus ? '<span class="rt-note">。バスは遅れやすいので余裕を</span>' : ''}</div>
    </div></li>`);
    rows.push(`<li class="rt-node"><span class="rt-dot"></span><div class="rt-body"><div class="rt-name">${label(leg.to)}</div>${tm != null ? `<div class="rt-time">${fmt(tm)} 着</div>` : ''}</div></li>`);
    boarded = key;
  }
  const egress = Math.round(route.accessToMin ?? 0);
  if (egress > 0) rows.push(`<li class="rt-leg rt-walk"><span class="rt-bar"></span><div class="rt-body"><div class="rt-line">徒歩 約${egress}分</div></div></li>`);
  if (tm != null) tm += egress;
  rows.push(`<li class="rt-node rt-dest"><span class="rt-dot"></span><div class="rt-body"><div class="rt-name">${esc(destLabel)}</div>${tm != null ? `<div class="rt-time">${fmt(tm)} 到着</div>` : ''}</div></li>`);
  const head = `<div class="rt-head">${startMin != null ? `<span class="rt-big">${fmt(startMin - access)}</span> 発 → <span class="rt-big">${fmt(tm)}</span> 着` : `所要 約${Math.round(route.totalMin)}分`}<span class="rt-meta">・${stationsTotal}${route.legs.some((l) => l.type === 'bus') ? '駅・停留所' : '駅'}・乗り換え${transfers}回</span></div>`;
  return `<div class="rt">${head}<ol class="rt-legs">${rows.join('')}</ol></div>`;
}

export const ROUTE_VIEW_CSS = `
.rt{margin:8px 0 4px}
.rt-head{font-size:.95rem;margin:0 0 6px}
.rt-big{font-size:1.25rem;font-weight:800}
.rt-meta{color:var(--muted);font-size:.85rem;margin-left:6px}
.rt-legs{list-style:none;margin:0;padding:0 0 0 4px}
.rt-node,.rt-leg{position:relative;display:flex;gap:12px;align-items:flex-start;white-space:normal}
.rt-node .rt-dot{flex:0 0 14px;width:14px;height:14px;border-radius:50%;border:3px solid var(--fg);background:var(--card);margin-top:4px;box-sizing:border-box}
.rt-origin .rt-dot,.rt-dest .rt-dot{background:var(--fg)}
.rt-node .rt-body{padding:0 0 2px}
.rt-name{font-weight:700}
.rt-kind{color:var(--muted);font-size:.75rem;margin-left:3px;font-weight:400}
.rt-time{color:var(--muted);font-size:.85rem}
.rt-leg .rt-bar{flex:0 0 14px;width:14px;align-self:stretch;position:relative;min-height:34px}
.rt-leg .rt-bar::before{content:"";position:absolute;left:4px;top:-4px;bottom:-4px;width:6px;border-radius:3px;background:var(--c,#8b94ad)}
.rt-walk .rt-bar::before{width:0;border-left:3px dotted var(--muted);left:5px;background:none;border-radius:0}
.rt-leg .rt-body{padding:6px 0 8px}
.rt-line{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rt-swatch{display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--c)}
.rt-dir{color:var(--muted);font-size:.85rem}
.rt-sub{color:var(--muted);font-size:.85rem;margin-top:2px}
.rt-sub strong{color:var(--fg)}
.rt-note{color:var(--warn)}
.rt-badge{display:inline-block;padding:0 8px;border-radius:999px;font-size:.75rem;font-weight:700;border:1px solid var(--line)}
.rt-badge.ok{color:var(--ok);border-color:var(--ok)}
.rt-badge.ng{color:var(--ng);border-color:var(--ng)}
.rt-badge.warn{color:var(--warn);border-color:var(--warn)}
`;
