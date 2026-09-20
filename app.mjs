import { parseTle, makeSatrec, observer, iteratePasses, DEFAULT_CRITERIA } from './lib/passes.mjs?v=e9adfac-0938';
import { fetchHourly, assessSite, FORECAST_DAYS } from './lib/weather.mjs?v=e9adfac-0938';
import { describePass, HOW_TO_FIND, dir16 } from './lib/describe.mjs?v=e9adfac-0938';
import { estimateTravel, PLAN_MARGINS } from './lib/plan.mjs?v=e9adfac-0938';
import { loadTransit } from './lib/transit.mjs?v=e9adfac-0938';
import { packingList } from './lib/packing.mjs?v=e9adfac-0938';
import { elevationGuideSvg, twilightSvg, observationSceneSvg } from './illustrations.mjs?v=e9adfac-0938';
import { showSiteMap, startCompass, stopCompass } from './onsite.mjs?v=e9adfac-0938';
import { hasAnyToken, lineStatuses, fetchStationTimetable, trainTypeJa } from './odpt.mjs?v=e9adfac-0938';

const DAYS = 60;
const TZ = 9;
const CENTER = { lat: 35.681, lon: 139.767 }; // 東京駅。見える時刻は首都圏内でほぼ同じ
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const $ = (s) => document.querySelector(s);
const jst = (d) => new Date(d.getTime() + TZ * 3600e3);
const hhmm = (d) => jst(d).toISOString().slice(11, 16);
const localDate = (d) => jst(d).toISOString().slice(0, 10);
const nightKey = (d) => localDate(new Date(d.getTime() - 12 * 3600e3)); // 正午区切りの「夜」
const md = (key) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}(${WEEKDAYS[new Date(`${key}T12:00:00+09:00`).getDay()]})`;
const localHour = (d) => jst(d).getUTCHours() + jst(d).getUTCMinutes() / 60;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const minOfDay = (d, dateKey) => Math.round((d.getTime() - new Date(`${dateKey}T00:00:00+09:00`).getTime()) / 60e3); // その日の 0:00 からの分（翌日は 1440+）
const fmtMin = (m) => { const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); return h >= 24 ? `翌${h - 24}:${mm}` : `${h}:${mm}`; };
const isHoliday = (dateKey) => [0, 6].includes(new Date(`${dateKey}T12:00:00+09:00`).getDay());

// ---------- 画面（① 日と出発駅 / ② 観測場所 / ③ 計画 / ④ 見方と説明） ----------
const enabledScreens = new Set([1, 4]);
function showScreen(n) {
  for (const k of [1, 2, 3, 4]) $(`#screen${k}`).hidden = k !== n;
  document.querySelectorAll('.steps button').forEach((b) => {
    const k = Number(b.dataset.go);
    b.disabled = !enabledScreens.has(k);
    if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function enableScreen(n) { enabledScreens.add(n); document.querySelectorAll('.steps button').forEach((b) => { if (Number(b.dataset.go) === n) b.disabled = false; }); }
function disableScreens(...ns) { for (const n of ns) enabledScreens.delete(n); document.querySelectorAll('.steps button').forEach((b) => { if (ns.includes(Number(b.dataset.go))) b.disabled = true; }); }

// ---------- 端末に保存するもの（出発地の登録・お気に入り） ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const myOrigins = () => store.get('myOrigins', []);
const favSites = () => new Set(store.get('favSites', []));
const isFav = (id) => favSites().has(id);
function toggleFav(id) { const s = favSites(); if (s.has(id)) s.delete(id); else s.add(id); store.set('favSites', [...s]); }

const state = {
  satrec: null, sites: [], stations: [], rows: [], transit: null,
  dateKey: null, pass: null, entries: [], from: null, // from: 出発地 {id, name, lat, lon, lines}
  site: null, sitePass: null,
  plan: null, // { good, withWeather, cloudyNote, best }
};

// ---------- 軌道 ----------
// CelesTrak は同じ問い合わせの繰り返しを嫌う（目安 2 時間に 1 回）ので、端末に 6 時間キャッシュする
async function loadTle() {
  const url = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
  const CACHE_KEY = 'tleCache', MAX_AGE = 6 * 3600e3;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { /* ignore */ }
  if (cached && Date.now() - cached.at < MAX_AGE) return { tle: parseTle(cached.text), source: 'CelesTrak（この端末に保存した最新データ）' };
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const tle = parseTle(text);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), text })); } catch { /* ignore */ }
      return { tle, source: 'CelesTrak の最新データ' };
    }
  } catch { /* fall through */ }
  if (cached) return { tle: parseTle(cached.text), source: 'CelesTrak（この端末に保存したデータ。更新に失敗）' };
  const res = await fetch('./data/iss.tle?v=e9adfac-0938');
  return { tle: parseTle(await res.text()), source: '同梱ファイル（CelesTrak に届かなかったため）' };
}
function tleEpoch(satrec) {
  const y = 2000 + satrec.epochyr;
  return new Date(Date.UTC(y, 0, 1) + (satrec.epochdays - 1) * 86400e3);
}
function computeRows(obs, from, to) {
  const rows = [];
  for (const p of iteratePasses(state.satrec, obs, from, to, DEFAULT_CRITERIA)) {
    if (!p.qualifies) continue;
    const v = p.visible;
    const h = localHour(v.peak.d);
    rows.push({
      night: nightKey(v.peak.d),
      slot: h >= 17 ? 'evening' : h < 6 ? 'morning' : 'other',
      start: { d: v.start.d, az: v.start.az, el: v.start.el },
      peak: { d: v.peak.d, az: v.peak.az, el: v.peak.el },
      end: { d: v.end.d, az: v.end.az, el: v.end.el },
      visStart: v.start.d, visEnd: v.end.d,
      maxEl: v.maxElevation, mag: v.bestMagnitude,
    });
  }
  return rows;
}

// ---------- 一覧 ----------
function row(r) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${md(r.night)}</td><td>${hhmm(r.visStart)}</td><td>${hhmm(r.peak.d)}</td><td>${hhmm(r.visEnd)}</td>`
    + `<td>${dir16(r.start.az)}→${dir16(r.peak.az)}→${dir16(r.end.az)}</td><td class="num">${r.maxEl.toFixed(0)}°</td><td class="num">${r.mag.toFixed(1)}等</td>`;
  return tr;
}
function renderLists(rows) {
  const ev = rows.filter((r) => r.slot === 'evening');
  const mo = rows.filter((r) => r.slot === 'morning');
  const tbE = $('#evening tbody');
  tbE.replaceChildren();
  let lastNight = null;
  for (const r of ev) {
    if (lastNight && (new Date(r.night) - new Date(lastNight)) / 86400e3 > 3) {
      const gap = document.createElement('tr');
      gap.innerHTML = '<td colspan="7" class="sep">ここから次に見える時期</td>';
      tbE.appendChild(gap);
    }
    const tr = row(r);
    tr.className = 'day-row';
    tr.title = 'この日を調べる';
    tr.addEventListener('click', () => { $('#plan [name=date]').value = r.night; runPlan().catch(showError); });
    tbE.appendChild(tr);
    lastNight = r.night;
  }
  $('#eveningEmpty').hidden = ev.length > 0;
  const tbM = $('#morning tbody');
  tbM.replaceChildren();
  for (const r of mo) {
    const tr = row(r);
    tr.className = 'day-row';
    tr.title = '前の晩から出かけて始発で帰る計画を見る';
    tr.addEventListener('click', () => { $('#plan [name=date]').value = r.night; runPlan().catch(showError); });
    tbM.appendChild(tr);
  }
}

// ---------- 指定日 ----------
function planForDate(dateKey) {
  const dayStart = new Date(`${dateKey}T12:00:00+09:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600e3); // 翌日正午まで（夜明け前の通過も含める）
  const obs = observer(CENTER.lat, CENTER.lon);
  const all = computeRows(obs, dayStart, dayEnd);
  const todays = all.filter((r) => r.slot === 'evening');
  const mornings = all.filter((r) => r.slot === 'morning');
  if (todays.length || mornings.length) return { todays, mornings };
  const future = computeRows(obs, dayEnd, new Date(dayEnd.getTime() + 90 * 86400e3)).filter((r) => r.slot === 'evening');
  return { todays: [], mornings: [], next: future[0] ?? null, nextWindow: windowOf(future) };
}
function windowOf(rows) {
  if (!rows.length) return null;
  const nights = [];
  for (const r of rows) {
    if (nights.length && (new Date(r.night) - new Date(nights[nights.length - 1])) / 86400e3 > 3) break;
    if (nights[nights.length - 1] !== r.night) nights.push(r.night);
  }
  return { from: nights[0], to: nights[nights.length - 1], count: nights.length };
}

function hideDetails() {
  for (const id of ['recoCard', 'sitesCard', 'howCard', 'onsiteCard']) $(`#${id}`).hidden = true;
  stopCompass();
}

function renderHeadline(dateKey, plan, now) {
  const isToday = dateKey === localDate(now);
  const label = isToday ? '今夜' : `${md(dateKey)}の夕方`;
  const pick = $('#passPick');
  pick.replaceChildren();
  const options = [...plan.todays.map((p) => ({ p, kind: 'evening' })), ...plan.mornings.map((p) => ({ p, kind: 'morning' }))];
  if (options.length) {
    const first = options[0];
    const r = first.p;
    if (first.kind === 'evening') {
      const past = r.visEnd < now;
      $('#headline').innerHTML = past
        ? `<span class="ng">${label}の通過はもう終わりました</span>`
        : `<span class="ok">${label}、見えます</span> ${hhmm(r.visStart)}〜${hhmm(r.visEnd)}`;
      $('#headlineDetail').textContent = `${dir16(r.start.az)}の空に現れ、${dir16(r.peak.az)}で最も高く（${r.maxEl.toFixed(0)}°）なり、${dir16(r.end.az)}で消えます。明るさ約${r.mag.toFixed(1)}等。`;
    } else {
      $('#headline').innerHTML = `<span class="warn">${label}は見えませんが、翌朝 ${hhmm(r.peak.d)} に見えます</span>`;
      $('#headlineDetail').textContent = `夜明け前の通過です。電車が動く前なので、前の晩に出かけて現地で待ち、始発で帰る計画になります。${dir16(r.start.az)}の空に現れ、${dir16(r.peak.az)}で最も高く（${r.maxEl.toFixed(0)}°）なります。`;
    }
    if (options.length > 1) {
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.textContent = o.kind === 'evening' ? `${hhmm(o.p.peak.d)}の通過（${o.p.maxEl.toFixed(0)}°）` : `翌朝 ${hhmm(o.p.peak.d)} の通過（${o.p.maxEl.toFixed(0)}°、始発で帰る）`;
        b.setAttribute('aria-pressed', String(i === 0));
        b.addEventListener('click', () => { selectPass(o.p, o.kind); pick.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
        pick.appendChild(b);
      });
    }
    selectPass(r, first.kind);
  } else {
    $('#headline').innerHTML = `<span class="ng">${label}は見えません</span>`;
    const w = plan.nextWindow;
    $('#headlineDetail').textContent = w
      ? `次に夕方に見えるのは ${md(w.from)}${w.count > 1 ? `〜${md(w.to)}` : ''}（${w.count}日間）。最初の日は ${hhmm(plan.next.peak.d)} ごろ、最大の高さ ${plan.next.maxEl.toFixed(0)}°。下の一覧の日付を押すと、その日の計画を出します。`
      : '90日以内に夕方に見える日はありません。';
    hideDetails();
  }
}

// ---------- 通過を選んだあと: 見方・候補地・おすすめ ----------
async function selectPass(r, kind = 'evening') {
  state.pass = r;
  state.passKind = kind;
  $('#describe').innerHTML = describePass(r).map((t) => `<p>${t}</p>`).join('');
  $('#scene').innerHTML = observationSceneSvg(r);
  $('#howto').innerHTML = HOW_TO_FIND.map((t) => `<li>${t}</li>`).join('');
  $('#howCard').hidden = false;
  $('#sitesCard').hidden = false;
  $('#recoCard').hidden = false;
  $('#reco').innerHTML = '<p class="muted">候補地と天気と経路を調べています…</p>';
  $('#sitesList').replaceChildren();
  $('#goBest').hidden = true;
  state.plan = null;
  disableScreens(3);

  const daysAhead = (new Date(`${state.dateKey}T12:00:00+09:00`) - new Date()) / 86400e3;
  let entries;
  let withWeather = false;
  if (daysAhead > FORECAST_DAYS - 1) {
    $('#sitesNote').textContent = `天気予報は${FORECAST_DAYS}日先までです。この日は予報がまだ無いので、雲を見ずに候補地を並べています。近づいたらもう一度調べてください。`;
    entries = state.sites.map((s) => ({ site: s, w: { available: false }, pass: sitePass(s, r) }));
  } else {
    $('#sitesNote').textContent = '天気を取得中…';
    try {
      const hourly = await hourlyAll();
      entries = state.sites.map((s, i) => ({ site: s, w: assessSite(hourly[i], r.peak.d), pass: sitePass(s, r) }));
      withWeather = true;
      const okCount = entries.filter((e) => e.w.available && e.w.observable).length;
      $('#sitesNote').textContent = okCount
        ? `観測時刻（${hhmm(r.peak.d)}）の予報で、低い雲と中間の雲の合計が20%以下の場所を「晴れ」としています。${okCount}か所が晴れの見込みです。`
        : '観測時刻の予報では、どの候補地も雲が多い見込みです。前日と当日にもう一度調べてください。';
    } catch (err) {
      $('#sitesNote').textContent = `天気を取得できませんでした（${err.message}）。雲を見ずに候補地を並べています。`;
      entries = state.sites.map((s) => ({ site: s, w: { available: false }, pass: sitePass(s, r) }));
    }
  }
  // 出発地からの経路と所要
  for (const e of entries) e.travel = state.from ? computeTravel(e.site) : null;
  // 並べ替え: 晴れ > 雲量 > 所要時間 > 徒歩
  const score = (e) => {
    if (!e.pass) return 1e9;
    let s = 0;
    if (withWeather && e.w.available) s += (e.w.observable ? 0 : 1000) + e.w.obs.cloudLowMid * 3;
    else s += 500;
    s += e.travel ? e.travel.totalMin : e.site.walkMin;
    if (isFav(e.site.id)) s -= 60; // お気に入りは同じ天気なら優先
    if (e.site.roadNearby) s += 15; // 幹線道路のそば（明るい・車が多い）は少し下げる
    return s;
  };
  entries.sort((a, b) => score(a) - score(b));
  state.entries = entries;
  renderSites(entries, withWeather);
  await renderRecommendation(entries, withWeather);
}

function sitePass(site, r) {
  const obs = observer(site.lat, site.lon);
  const rows = computeRows(obs, new Date(r.visStart.getTime() - 15 * 60e3), new Date(r.visEnd.getTime() + 15 * 60e3));
  return rows[0] ?? null;
}

function warnsOf(e) {
  const warns = [];
  if (e.w.available) {
    const o = e.w.outbound, b = e.w.inbound;
    if (o.warn.length) warns.push(`行き: ${o.warn.join('・')}`);
    if (b.warn.length) warns.push(`帰り: ${b.warn.join('・')}`);
    if (o.cycle === false || b.cycle === false) warns.push('自転車は不向き');
    if (Math.max(o.walkMaxMin, b.walkMaxMin) < e.site.walkMin) warns.push('雨の日は徒歩が長め');
  }
  return warns;
}

// ---------- 経路（ODPT の駅グラフ） ----------
function originStationIdx() {
  if (!state.transit || !state.from || state.from.id === 'geo') return null;
  const idx = state.transit.findStations(state.from.name);
  return idx.length ? idx : null;
}
function siteStationIdx(site) {
  if (!state.transit) return null;
  const idx = state.transit.findStations(site.station, site.lines?.[0]?.replace(/^JR/, ''));
  return idx.length ? idx : null;
}
/** 出発地 → 観測地（行き）と 観測地 → 出発地（帰り）の経路。ODPT データが無ければ距離からの概算 */
function computeTravel(site) {
  if (state.transit && state.from) {
    const o = originStationIdx();
    const s = siteStationIdx(site);
    const fromSpec = o ? { stationIdx: o, accessMin: 3 } : { lat: state.from.lat, lon: state.from.lon };
    const toSpec = s ? { stationIdx: s, accessMin: site.walkMin } : { lat: site.lat, lon: site.lon };
    const go = state.transit.plan(fromSpec, toSpec);
    const back = state.transit.plan(s ? { stationIdx: s, accessMin: site.walkMin } : { lat: site.lat, lon: site.lon }, o ? { stationIdx: o, accessMin: 3 } : { lat: state.from.lat, lon: state.from.lon });
    if (go) return { totalMin: Math.round(go.totalMin), backMin: back ? Math.round(back.totalMin) : Math.round(go.totalMin), go, back, source: 'odpt' };
  }
  const est = estimateTravel(state.from, site);
  return { totalMin: est.totalMin, backMin: est.totalMin, go: null, back: null, source: 'estimate', km: est.km };
}
function terminalName(leg) {
  const t = state.transit;
  const sign = t.legSign(leg);
  const order = t.stationIndexByRailway.get(leg.railway);
  if (!sign || !order) return null;
  let best = null;
  for (const [idx, pos] of order) if (!best || (sign === '+' ? pos > best.pos : pos < best.pos)) best = { idx, pos };
  return best ? t.data.stations[best.idx].n : null;
}
function nextStationName(leg) {
  const t = state.transit;
  const order = t.stationIndexByRailway.get(leg.railway);
  const sign = t.legSign(leg);
  if (!order || !sign) return null;
  const pos = order.get(leg.from);
  for (const [idx, p] of order) if (p === pos + (sign === '+' ? 1 : -1)) return t.data.stations[idx].n;
  return null;
}
/** 経路を「乗る・降りる」の文にする */
function legsHtml(route, accessLabel, egressLabel) {
  const t = state.transit;
  const s = t.data.stations;
  const items = [];
  if (accessLabel) items.push(`<li>${accessLabel}</li>`);
  for (const leg of route.legs) {
    if (leg.type === 'transfer') {
      items.push(`<li>${esc(s[leg.from].n)}駅で乗り換え（${esc(s[leg.to].n)}駅${s[leg.from].n === s[leg.to].n ? '' : 'へ'}、徒歩と待ち 約${Math.round(leg.min) + 4}分）</li>`);
      continue;
    }
    const rw = t.railwayById.get(leg.railway)?.n ?? leg.railway;
    const term = terminalName(leg);
    const next = nextStationName(leg);
    const dirTxt = term ? `${next && next !== term ? `${esc(next)}・` : ''}${esc(term)}方面` : '';
    items.push(`<li><strong>${esc(s[leg.from].n)}駅</strong>から <strong>${esc(rw)}</strong>${dirTxt ? `（${dirTxt}）` : ''}に乗る → <strong>${esc(s[leg.to].n)}駅</strong>で降りる（${leg.stops}駅・約${Math.round(leg.min)}分）</li>`);
  }
  if (egressLabel) items.push(`<li>${egressLabel}</li>`);
  return `<ol class="legs">${items.join('')}</ol>`;
}
/** 帰りの最終電車 / 行きの終電 / 帰りの始発（最初に乗る区間の駅・路線・方向で引く） */
function firstLastFor(route, holiday) {
  const t = state.transit;
  const leg = route?.legs.find((l) => l.type === 'rail');
  if (!leg) return null;
  const sign = t.legSign(leg);
  const fl = t.firstLast(leg.from, leg.railway, sign, holiday);
  if (!fl) return null;
  return { first: fl[0], last: fl[1], station: t.data.stations[leg.from].n, railway: t.railwayById.get(leg.railway)?.n ?? leg.railway, toward: terminalName(leg) };
}

function renderSites(entries, withWeather) {
  const box = $('#sitesList');
  box.replaceChildren();
  entries.forEach((e, i) => {
    const card = document.createElement('div');
    const cloud = e.w.available ? `${e.w.obs.cloudLowMid}%` : '予報なし';
    const obsBadge = !e.pass ? '<span class="badge ng">条件外</span>'
      : !e.w.available ? '<span class="badge">天気未定</span>'
        : e.w.observable ? '<span class="badge ok">晴れ</span>' : '<span class="badge ng">雲</span>';
    const warns = warnsOf(e);
    const travel = e.travel ? `${state.from ? esc(state.from.name) + 'から' : ''}約${e.travel.totalMin}分${e.travel.source === 'estimate' ? '<span class="muted">（概算）</span>' : ''}` : '';
    const access = (e.site.nightAccess === '不明' ? '<div class="line warn">夜間に入れるか公式の記載が見つかっていません</div>' : e.site.nightAccess === '常時開園' ? '<div class="line">常時開園（公式サイトで確認）</div>' : '')
      + (e.site.roadNearby ? `<div class="line warn">近くに大きな道路（約${e.site.majorRoadM} m）。明るく車が多いので、道路から離れた側に立つ</div>` : '<div class="line">大きな道路から離れていて暗め</div>');
    card.className = `site-card${e.pass ? '' : ' dim'}`;
    card.innerHTML = `
      <div class="top">
        <div><span class="rank">${i + 1}</span><button type="button" class="star" aria-pressed="${isFav(e.site.id)}" title="お気に入り" data-fav="${esc(e.site.id)}">${isFav(e.site.id) ? '★' : '☆'}</button><span class="name">${esc(e.site.name)}</span></div>
        <div class="cloud">${obsBadge}<br><span class="muted small">雲 ${cloud}</span></div>
      </div>
      <div class="line">${esc(e.site.station)}駅 徒歩${e.site.walkMin}分（${e.site.lines.map(esc).join('・')}）${travel ? `・${travel}` : ''}</div>
      <div class="line">${esc(e.site.landmark)}</div>
      ${access}
      ${warns.length ? `<div class="warn">注意: ${warns.join('、')}</div>` : ''}
      ${e.pass ? '<div class="act"><button type="button" class="primary">ここで見る →</button></div>' : ''}`;
    card.addEventListener('click', () => selectSite(e, card, { go: true }));
    card.querySelector('button.star').addEventListener('click', (ev) => { ev.stopPropagation(); toggleFav(e.site.id); selectPass(state.pass, state.passKind); });
    box.appendChild(card);
  });
}

// ---------- おすすめ・計画 ----------
async function renderRecommendation(entries, withWeather) {
  const box = $('#reco');
  const good = entries.filter((e) => e.pass && (!withWeather || !e.w.available || e.w.observable));
  const best = good[0] ?? null;
  let cloudyNote = '';
  let pickFrom = good;
  if (!best) {
    cloudyNote = `<p class="headline ng">この日はどの候補地も雲が多い見込みです</p><p class="small">予報は変わります。前日と当日の夕方にもう一度調べてください。それでも雲なら、無理に出かけないのが正解です。下は、雲が晴れた場合に向けた<strong>おすすめ</strong>の計画です（雲が少ない順・近い順）。</p>`;
    pickFrom = entries.filter((e) => e.pass);
  }
  const pick = best ?? pickFrom[0];
  if (!pick) { box.innerHTML = cloudyNote || '<p class="ng">この日に条件を満たす候補地がありません。</p>'; $('#onsiteCard').hidden = true; return; }
  state.plan = { good: pickFrom, withWeather, cloudyNote, best: pick };
  const tr = [...document.querySelectorAll('#sitesList .site-card')][entries.indexOf(pick)];
  const btn = $('#goBest');
  btn.hidden = false;
  btn.textContent = `おすすめ: ${pick.site.name} で計画を見る →`;
  btn.onclick = () => selectSite(pick, tr, { go: true });
  return selectSite(pick, tr);
}

// ---------- 具体的な列車（駅時刻表から） ----------
const toMinStr = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const v = h * 60 + m; return v < 180 ? v + 1440 : v; };
/**
 * 区間 leg の乗車駅の時刻表から、条件に合う列車を選ぶ
 * mode 'latestBefore': limitMin 以前で最も遅い発車（行き）／ 'earliestAfter': limitMin 以後で最も早い発車（帰り）
 */
async function pickTrain(leg, limitMin, mode, holiday) {
  const t = state.transit;
  const st = t.data.stations[leg.from];
  const dirId = t.data.dirs?.[leg.railway]?.[t.legSign(leg)];
  if (!dirId) return null;
  const list = await fetchStationTimetable(st.id, leg.railway);
  const cal = holiday ? /SaturdayHoliday|Holiday/ : /Weekday/;
  const tt = list.find((x) => x['odpt:railDirection'] === dirId && cal.test(x['odpt:calendar'] ?? ''))
    ?? list.find((x) => x['odpt:railDirection'] === dirId);
  if (!tt) return null;
  const objs = (tt['odpt:stationTimetableObject'] ?? []).map((o) => ({
    min: toMinStr(o['odpt:departureTime'] ?? o['odpt:arrivalTime']),
    type: o['odpt:trainType'] ?? '',
    dest: (o['odpt:destinationStation'] ?? []).map((id) => t.data.stations.find((s) => s.id === id)?.n ?? String(id).split('.').pop()).join('・'),
  })).filter((o) => Number.isFinite(o.min)).sort((a, b) => a.min - b.min);
  // 各駅停車があればそれだけにする（快速などは降りる駅を通過することがある）
  const locals = objs.filter((o) => /Local$/.test(o.type));
  const pool = locals.length ? locals : objs;
  const allTypesUsed = !locals.length;
  let i;
  if (mode === 'latestBefore') { i = -1; for (let k = 0; k < pool.length; k++) if (pool[k].min <= limitMin) i = k; else break; }
  else { i = pool.findIndex((o) => o.min >= limitMin); }
  if (i < 0) return null;
  return { pick: pool[i], prev: pool[i - 1] ?? null, next: pool[i + 1] ?? null, allTypesUsed, station: st.n, railway: t.railwayById.get(leg.railway)?.n ?? leg.railway };
}
const trainLine = (tr) => `<strong>${fmtMin(tr.pick.min)} 発</strong> ${esc(tr.railway)} ${tr.pick.dest ? `${esc(tr.pick.dest)}行き` : ''}${tr.pick.type ? `（${esc(trainTypeJa(tr.pick.type))}）` : ''}`;

/** 行き・帰りの具体的な列車を非同期で埋める */
async function fillTrains(best, tv, holiday, arriveBy, leaveSite) {
  if (!state.transit) return;
  const goLeg = tv.go?.legs.find((l) => l.type === 'rail');
  const backLeg = tv.back?.legs.find((l) => l.type === 'rail');
  // 行き: 乗車駅を出てから現地までにかかる分 = 全体 − 出発地から駅までの徒歩 − 最初の待ち
  if (goLeg) {
    const afterBoard = tv.go.totalMin - (tv.go.accessFromMin ?? 0) - 4;
    const tr = await pickTrain(goLeg, arriveBy - afterBoard, 'latestBefore', holiday);
    const el = $('#goTrain');
    if (el) {
      el.innerHTML = tr
        ? `<div class="train">${trainLine(tr)} に乗る。<span class="small">改札には ${fmtMin(tr.pick.min - 5)} までに。${tr.prev ? `ひとつ前は ${fmtMin(tr.prev.min)} 発` : ''}${tr.next ? `、次の ${fmtMin(tr.next.min)} 発では到着締切に間に合いません` : ''}。${tr.allTypesUsed ? '快速・急行は降りる駅に止まらないことがあります。乗る前に案内表示で確認してください。' : ''}</span></div>`
        : '<div class="muted small">この駅の時刻表を取得できなかったため、出発の目安だけ表示しています。</div>';
    }
    if (tr) { const dep = $('#departBy'); if (dep) dep.textContent = `${fmtMin(tr.pick.min - 5)} まで`; }
  }
  if (backLeg) {
    const tr = await pickTrain(backLeg, leaveSite + best.site.walkMin, 'earliestAfter', holiday);
    const el = $('#backTrain');
    if (el) {
      el.innerHTML = tr
        ? `<div class="train">${trainLine(tr)} に乗る（現地を ${fmtMin(leaveSite)} に出て徒歩${best.site.walkMin}分）。<span class="small">${tr.next ? `次は ${fmtMin(tr.next.min)} 発。` : ''}${tr.allTypesUsed ? '快速・急行は乗り換え駅に止まらないことがあります。' : ''}</span></div>`
        : '';
    }
  }
}

function gmapsLink(from, to, label) {
  const o = from.id === 'geo' ? `${from.lat},${from.lon}` : `${from.name}駅`;
  const d = `${to.lat},${to.lon}`;
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=transit`;
  return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
}
function gmapsLinkBack(site, to, label) {
  const d = to.id === 'geo' ? `${to.lat},${to.lon}` : `${to.name}駅`;
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${site.lat},${site.lon}`)}&destination=${encodeURIComponent(d)}&travelmode=transit`;
  return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
}

function renderPlanFor(best, good, withWeather, cloudyNote) {
  const box = $('#reco');
  const p = best.pass;
  const now = new Date();
  const isBest = state.plan && best === state.plan.best;
  const overnight = state.passKind === 'morning';
  const holiday = isHoliday(overnight ? localDate(p.peak.d) : state.dateKey);
  const dayKey = state.dateKey; // 分は「見に行く日」の 0:00 起点。翌朝は 1440+
  const tv = best.travel;
  const m = PLAN_MARGINS;

  const reason = [];
  if (withWeather && best.w.available) reason.push(best.w.observable ? `観測時刻の雲が${best.w.obs.cloudLowMid}%と少ない` : `観測時刻の雲は${best.w.obs.cloudLowMid}%で多い`);
  if (tv) reason.push(`${esc(state.from.name)}から約${tv.totalMin}分`);
  reason.push(`${esc(best.site.station)}駅から徒歩${best.site.walkMin}分`);
  const warns = warnsOf(best);
  if (best.site.roadNearby) warns.push(`近くに大きな道路（約${best.site.majorRoadM} m）。道路の明かりを背にして、離れた側に立つ`);

  // ---- 時刻 ----
  const obsStart = minOfDay(p.start.d, dayKey), obsEnd = minOfDay(p.end.d, dayKey);
  const arriveBy = obsStart - m.arriveBeforeMin;
  const leaveSite = obsEnd + m.leaveAfterMin;
  let timeline = '';
  let packing = null;
  if (tv) {
    const goFL = tv.go ? firstLastFor(tv.go, holiday) : null;                      // 行きの最初の区間（出発駅側）の始発・終電
    const backFL = tv.back ? firstLastFor(tv.back, holiday) : null;                // 帰りの最初の区間（最寄駅側）の始発・終電
    const est = tv.source === 'estimate';
    const estNote = est ? '<span class="muted small">（この区間は ODPT の駅データに無いため距離からの概算）</span>' : '';
    const transfers = tv.go ? tv.go.legs.filter((l) => l.type === 'transfer').length : 0;
    const manyTransfers = transfers >= 2 ? '<p class="warn small">電車だと乗り換えが多い行き先です。バスの方が楽なことがあるので、下の Google マップ（バスを含む経路）も確かめてください。バスの時刻表はこのアプリではまだ扱えていません。</p>' : '';
    const goLegs = tv.go ? legsHtml(tv.go, `${esc(state.from.name)}${state.from.id === 'geo' ? 'から最寄駅へ歩く' : '駅の改札へ'}`, `${esc(best.site.station)}駅から徒歩${best.site.walkMin}分で <strong>${esc(best.site.name)}</strong>。${esc(best.site.landmark)}`) : '';
    const backLegs = tv.back ? legsHtml(tv.back, `${esc(best.site.name)}から${esc(best.site.station)}駅へ徒歩${best.site.walkMin}分`, `${esc(state.from.name)}${state.from.id === 'geo' ? '' : '駅'}に到着`) : '';
    if (!overnight) {
      const departBy = arriveBy - tv.totalMin;
      const returnBy = leaveSite + tv.backMin;
      const tooLate = dayKey === localDate(now) && departBy < minOfDay(now, dayKey);
      const lastOk = backFL ? backFL.last >= leaveSite : null;
      timeline = `<table class="timeline"><tbody>
        <tr><th>出発</th><td><strong class="${tooLate ? 'ng' : 'acc'}" id="departBy">${fmtMin(departBy)} まで</strong>に${esc(state.from.name)}を出る ${estNote}<div id="goTrain" class="muted small">乗る列車を時刻表から探しています…</div>${manyTransfers}${goLegs}<div class="small">${gmapsLink(state.from, best.site, 'Google マップで行きの経路を見る')}</div></td></tr>
        <tr><th>到着</th><td><strong>${fmtMin(arriveBy)}</strong> までに現地へ。方角を合わせて待つ（下の地図とコンパス）</td></tr>
        <tr><th>観測</th><td><strong>${fmtMin(obsStart)}〜${fmtMin(obsEnd)}</strong>（約${Math.max(1, Math.round((obsEnd - obsStart)))}分）</td></tr>
        <tr><th>帰り</th><td>${fmtMin(leaveSite)} ごろ現地を出る<div id="backTrain"></div>${backLegs}<div class="small">${gmapsLinkBack(best.site, state.from, 'Google マップで帰りの経路を見る')}</div>${backFL ? `<div class="${lastOk === false ? 'ng' : 'small'}">${esc(backFL.station)}駅 ${esc(backFL.railway)}${backFL.toward ? `（${esc(backFL.toward)}方面）` : ''}の<strong>最終電車 ${fmtMin(backFL.last)}</strong>${holiday ? '（土休日ダイヤ）' : '（平日ダイヤ）'}${lastOk === false ? '。観測後では間に合いません。別の候補地を選んでください' : ''}</div>` : '<div class="muted small">帰りの最終電車の時刻は取得できませんでした</div>'}</td></tr>
        <tr><th>帰宅</th><td><strong>${fmtMin(returnBy)}</strong> ごろ${esc(state.from.name)}に戻る<span class="muted small">（出発から帰宅まで 約${Math.floor((returnBy - departBy) / 60)}時間${(returnBy - departBy) % 60}分）</span></td></tr>
      </tbody></table>`
      + (tooLate ? '<p class="ng">出発の目安をもう過ぎています。次点の候補地か、今いる場所の近くで見ることを考えてください。</p>' : '');
    } else {
      // 夜通し: 前の晩の終電で行き、現地で待ち、始発で帰る
      const lastGo = goFL ? goFL.last : null;
      const arriveNight = lastGo != null ? lastGo + tv.totalMin : null;
      const firstBack = backFL ? backFL.first : null;
      const waitMin = arriveNight != null ? obsStart - arriveNight : null;
      const returnBy = firstBack != null ? Math.max(firstBack, leaveSite) + tv.backMin : null;
      timeline = `<p class="warn small">夜明け前の通過です。電車が動いていない時間なので、<strong>前の晩の終電で行き、始発で帰る</strong>計画です。現地や駅前で数時間待つことになります。無理はしないでください。</p>
      <table class="timeline"><tbody>
        <tr><th>前夜</th><td>${goFL ? `<strong>${fmtMin(lastGo)}</strong> ${esc(goFL.station)}駅 ${esc(goFL.railway)}${goFL.toward ? `（${esc(goFL.toward)}方面）` : ''}の最終電車に乗る${holiday ? '（土休日ダイヤ）' : '（平日ダイヤ）'}。もっと早い電車でも構いません` : '終電の時刻を取得できませんでした'} ${estNote}${goLegs}<div class="small">${gmapsLink(state.from, best.site, 'Google マップで行きの経路を見る')}</div></td></tr>
        <tr><th>到着</th><td>${arriveNight != null ? `<strong>${fmtMin(arriveNight)}</strong> ごろ現地。観測まで約${Math.floor(waitMin / 60)}時間${waitMin % 60}分の待機` : '—'}</td></tr>
        <tr><th>観測</th><td><strong>${fmtMin(obsStart)}〜${fmtMin(obsEnd)}</strong>（約${Math.max(1, Math.round((obsEnd - obsStart)))}分）</td></tr>
        <tr><th>始発</th><td>${backFL ? `${esc(backFL.station)}駅 ${esc(backFL.railway)}${backFL.toward ? `（${esc(backFL.toward)}方面）` : ''}の<strong>始発 ${fmtMin(firstBack)}</strong>${isHoliday(localDate(p.peak.d)) ? '（土休日ダイヤ）' : '（平日ダイヤ）'}` : '始発の時刻を取得できませんでした'}${backLegs}</td></tr>
        <tr><th>帰宅</th><td>${returnBy != null ? `<strong>${fmtMin(returnBy)}</strong> ごろ${esc(state.from.name)}に戻る` : '—'}</td></tr>
      </tbody></table>`;
    }
    // 持ち物
    const w = best.w.available ? best.w : null;
    packing = packingList({
      tempC: w ? w.obs.temp : null,
      precipProb: w ? Math.max(w.outbound.precipProb ?? 0, w.inbound.precipProb ?? 0) : 0,
      precip: w ? Math.max(w.outbound.precip ?? 0, w.inbound.precip ?? 0) : 0,
      wind: w ? Math.max(w.outbound.wind ?? 0, w.inbound.wind ?? 0) : 0,
      overnight, siteType: best.site.type, date: p.peak.d,
    });
  } else {
    timeline = `<p class="muted small">上の「出発駅」を選ぶと、乗る電車・出発時刻・帰りの最終電車を出します。</p>
      <table class="timeline"><tbody>
      <tr><th>到着</th><td><strong>${fmtMin(arriveBy)}</strong> までに${esc(best.site.name)}へ（${esc(best.site.station)}駅 徒歩${best.site.walkMin}分）</td></tr>
      <tr><th>観測</th><td><strong>${fmtMin(obsStart)}〜${fmtMin(obsEnd)}</strong></td></tr>
      </tbody></table>`;
    packing = packingList({ tempC: best.w.available ? best.w.obs.temp : null, precipProb: 0, precip: 0, wind: 0, overnight, siteType: best.site.type, date: p.peak.d });
  }
  const alts = good.filter((e) => e !== best).slice(0, 2).map((e) => `<li><button type="button" class="link" data-site="${esc(e.site.id)}">${esc(e.site.name)}</button>（${esc(e.site.station)}駅 徒歩${e.site.walkMin}分${e.w.available ? `、雲${e.w.obs.cloudLowMid}%` : ''}${e.travel ? `、約${e.travel.totalMin}分` : ''}）</li>`).join('');

  box.innerHTML = `
    ${cloudyNote}
    <p class="headline"><span class="acc">${isBest ? 'おすすめ' : '選んだ場所'}</span> ${esc(best.site.name)}</p>
    ${!isBest && state.plan?.best ? `<p class="muted small">おすすめは ${esc(state.plan.best.site.name)} です。<button type="button" class="link" data-site="${esc(state.plan.best.site.id)}">おすすめに戻す</button></p>` : ''}
    <p class="small">${reason.join('。')}。${esc(best.site.landmark)}。</p>
    ${warns.length ? `<p class="warn small">注意: ${warns.join('、')}</p>` : ''}
    ${timeline}
    <div id="trainInfo" class="small"><span class="muted">運行情報を確認中…</span></div>
    ${packing ? `<details class="packing" open><summary>持って行くもの</summary><p class="small"><strong>必ず</strong></p><ul class="small">${packing.must.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="small"><strong>あると良い</strong></p><ul class="small">${packing.nice.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    ${alts ? `<p class="small" style="margin-top:10px">雲が流れたとき・電車が遅れたときの次点: </p><ul class="small">${alts}</ul>` : ''}
  `;
  box.querySelectorAll('button[data-site]').forEach((b) => b.addEventListener('click', () => {
    const e = state.entries.find((x) => x.site.id === b.dataset.site);
    const tr = [...document.querySelectorAll('#sitesList .site-card')][state.entries.indexOf(e)];
    selectSite(e, tr);
  }));
  if (tv && !overnight) fillTrains(best, tv, holiday, arriveBy, leaveSite).catch(console.error);
  return renderTrainInfo(best, good);
}

async function renderTrainInfo(best, good) {
  const el = $('#trainInfo');
  if (!el) return;
  // 経路で実際に使う路線を優先し、無ければ出発駅と最寄駅の路線
  const used = new Map(); // railway id -> 表示名
  const tv = best.travel;
  const legRailways = (t) => (t ? t.legs.filter((l) => l.type === 'rail').map((l) => l.railway) : []);
  if (state.transit && tv?.go) for (const rid of [...legRailways(tv.go), ...legRailways(tv.back)]) used.set(rid, state.transit.railwayById.get(rid)?.n ?? rid);
  const lines = used.size ? [...used].map(([id, name]) => ({ id, name })) : [...new Set([...(state.from?.lines ?? []), ...best.site.lines])];
  const lineName = (x) => (typeof x === 'string' ? x : x.name);
  if (!hasAnyToken()) {
    el.innerHTML = '<span class="muted">運行情報は取得できません（このページの設定にトークンが含まれていません）。</span>';
    return;
  }
  if (state.dateKey !== localDate(new Date())) {
    el.innerHTML = `<span class="muted">運行情報（遅れ・運休）は当日にこの画面を開くと表示します。${md(state.dateKey)}の朝と出発前に確認してください。</span>`;
    return;
  }
  try {
    const st = await lineStatuses(lines);
    const delayed = st.filter((s) => s.delayed);
    const notices = st.filter((s) => s.notice);
    const unsupported = st.filter((s) => !s.supported).map((s) => s.line);
    let html = '';
    if (delayed.length) {
      html += `<p class="ng"><strong>遅れあり:</strong> ${delayed.map((s) => `${esc(s.line)}「${esc(s.text || s.status)}」`).join(' / ')}</p>`;
      const delayedLines = new Set(delayed.map((s) => s.line));
      // 次点は、その候補地の経路で使う路線も運行情報で照合して、遅れの無いものを選ぶ（結果は 60 秒キャッシュ）
      let alt = null;
      for (const e of good.filter((x) => x !== best).slice(0, 6)) {
        let candLines;
        if (state.transit && e.travel?.go) candLines = [...new Set([...legRailways(e.travel.go), ...legRailways(e.travel.back)])].map((id) => ({ id, name: state.transit.railwayById.get(id)?.n ?? id }));
        else candLines = e.site.lines;
        const cst = await lineStatuses(candLines);
        if (cst && !cst.some((s) => s.delayed)) { alt = e; break; }
      }
      html += alt
        ? `<p>この路線を使わずに行ける次点は <button type="button" class="link" data-alt="${esc(alt.site.id)}">${esc(alt.site.name)}</button>（${esc(alt.site.station)}駅、${alt.site.lines.map(esc).join('・')}）です。出発時刻の目安が過ぎていなければそちらへ。間に合わないときは、今いる場所の近くで空の開けた所を探してください。通過の時刻と方角は同じです。</p>`
        : '<p>別路線の次点が見つかりません。復旧見込みを確認し、間に合わないときは今いる場所の近くで空の開けた所を探してください。</p>';
    } else {
      html += `<p class="ok">運行情報: 乗る路線（${lines.map((x) => esc(lineName(x))).join('・')}）はいま平常です（${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 時点）。出発前にもう一度この画面を開いて確かめてください。</p>`;
    }
    if (notices.length) html += `<p class="warn">お知らせ: ${notices.map((s) => `${esc(s.line)}「${esc((s.text || s.status).slice(0, 80))}${(s.text || '').length > 80 ? '…' : ''}」`).join(' / ')}</p>`;
    if (unsupported.length) html += `<p class="muted">運行情報に未対応の路線: ${unsupported.map(esc).join('・')}</p>`;
    el.innerHTML = html;
    el.querySelectorAll('button[data-alt]').forEach((b) => b.addEventListener('click', () => {
      const e = state.entries.find((x) => x.site.id === b.dataset.alt);
      const tr = [...document.querySelectorAll('#sitesList .site-card')][state.entries.indexOf(e)];
      selectSite(e, tr, { go: true });
    }));
  } catch (err) {
    el.innerHTML = `<span class="warn">運行情報を取得できませんでした（${esc(err.message)}）。</span>`;
  }
}

// ---------- 現地 ----------
async function selectSite(e, tr, { go = false } = {}) {
  if (!e?.pass) return;
  state.site = e.site;
  state.sitePass = e.pass;
  if (state.plan) {
    renderPlanFor(e, state.plan.good, state.plan.withWeather, state.plan.cloudyNote);
    enableScreen(3);
    if (go) showScreen(3);
  }
  document.querySelectorAll('#sitesList .site-card').forEach((x) => x.classList.toggle('selected', x === tr));
  $('#onsiteCard').hidden = false;
  $('#onsiteSite').innerHTML = `<strong>${esc(e.site.name)}</strong>（${esc(e.site.station)}駅 徒歩${e.site.walkMin}分）。${esc(e.site.landmark)}。`;
  stopCompass();
  $('#compass').innerHTML = '';
  $('#compassStatus').textContent = '';
  try { await showSiteMap('map', e.site, e.pass); } catch (err) { $('#map').textContent = err.message; }
}

// ---------- 入力 ----------
function readFrom() {
  const v = $('#fromForm [name=from]').value;
  if (!v) { state.from = null; return; }
  if (v === 'geo') {
    if (state.from?.id === 'geo') return;
    state.from = null;
    navigator.geolocation?.getCurrentPosition((pos) => {
      state.from = { id: 'geo', name: '現在地', lat: pos.coords.latitude, lon: pos.coords.longitude, lines: [] };
      runPlan().catch(showError);
    }, () => { $('#status').textContent = '現在地を取得できませんでした'; });
    return;
  }
  state.from = state.stations.find((s) => s.id === v) ?? myOrigins().find((s) => s.id === v) ?? null;
}

// 出発駅の選択肢を組み立てる（登録した駅を先頭に）
function renderFromOptions(keep) {
  const sel = $('#fromForm [name=from]');
  const cur = keep ?? sel.value;
  sel.replaceChildren();
  const add = (parent, value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; parent.appendChild(o); };
  add(sel, '', '（選んでください）');
  add(sel, 'geo', '現在地');
  const mine = myOrigins();
  if (mine.length) {
    const g = document.createElement('optgroup'); g.label = '登録した駅';
    for (const s of mine) add(g, s.id, s.name);
    sel.appendChild(g);
  }
  const g2 = document.createElement('optgroup'); g2.label = '主要駅';
  for (const s of state.stations) add(g2, s.id, s.name);
  sel.appendChild(g2);
  sel.value = cur;
  if (sel.value !== cur) sel.value = '';
  const ul = $('#originList');
  ul.replaceChildren();
  for (const s of mine) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(s.name)}駅</span><button type="button" class="link small" data-del="${esc(s.id)}">削除</button>`;
    li.querySelector('button').addEventListener('click', () => { store.set('myOrigins', mine.filter((x) => x.id !== s.id)); renderFromOptions(sel.value === s.id ? '' : sel.value); });
    ul.appendChild(li);
  }
}
function registerOrigin(name) {
  name = name.trim().replace(/駅$/, '');
  if (!name) return '駅名を入れてください';
  if (!state.transit) return '駅データを読み込めていません';
  const idx = state.transit.findStations(name);
  if (!idx.length) {
    const cands = [...new Set(state.transit.data.stations.filter((s) => s.n.startsWith(name)).map((s) => s.n))].slice(0, 5);
    return cands.length ? `見つかりません。もしかして: ${cands.join('、')}` : '首都圏の鉄道駅に見つかりません';
  }
  const s = state.transit.data.stations[idx[0]];
  const lines = [...new Set(idx.map((i) => state.transit.railwayById.get(state.transit.data.stations[i].r)?.n).filter(Boolean))];
  const mine = myOrigins();
  const id = `my:${name}`;
  if (!mine.some((x) => x.id === id)) { mine.unshift({ id, name, lat: s.lat, lon: s.lon, lines }); store.set('myOrigins', mine); }
  renderFromOptions(id);
  store.set('fromStation', id);
  readFrom();
  renderProposals().catch(console.error);
  return `${name}駅を登録しました（${lines.join('・')}）`;
}

async function runPlan() {
  $('#status').textContent = '計算中…';
  state.dateKey = $('#plan [name=date]').value;
  readFrom();
  const plan = planForDate(state.dateKey);
  enableScreen(2);
  showScreen(2);
  renderHeadline(state.dateKey, plan, new Date());
  $('#status').textContent = '';
}

// ---------- ① 提案一覧 ----------
let hourlyCache = null;
async function hourlyAll() {
  if (hourlyCache && Date.now() - hourlyCache.at < 10 * 60e3) return hourlyCache.data;
  const data = await fetchHourly(state.sites);
  hourlyCache = { at: Date.now(), data };
  return data;
}
async function renderProposals() {
  const now = new Date();
  const ev = state.rows.filter((r) => r.slot === 'evening' && r.visEnd > now);
  const mo = state.rows.filter((r) => r.slot === 'morning' && r.visEnd > now);
  let hourly = null;
  try { hourly = await hourlyAll(); } catch { hourly = null; }
  const item = (r, kind) => {
    const daysAhead = (r.peak.d - now) / 86400e3;
    let where = '';
    let cls = '';
    if (hourly && daysAhead < FORECAST_DAYS - 1) {
      const scored = state.sites.map((s, i) => ({ s, w: assessSite(hourly[i], r.peak.d) })).filter((x) => x.w.available);
      const clear = scored.filter((x) => x.w.observable);
      if (clear.length) {
        // 雲が少なく、出発駅が選ばれていれば近い場所
        for (const x of clear) x.travel = state.from ? computeTravel(x.s) : null;
        clear.sort((p, q) => (p.w.obs.cloudLowMid * 3 + (p.travel ? p.travel.totalMin : p.s.walkMin) - (isFav(p.s.id) ? 60 : 0)) - (q.w.obs.cloudLowMid * 3 + (q.travel ? q.travel.totalMin : q.s.walkMin) - (isFav(q.s.id) ? 60 : 0)));
        const b = clear[0];
        where = `<div class="where"><span class="acc">${isFav(b.s.id) ? '★お気に入り' : 'おすすめ'}</span> ${esc(b.s.name)}<span class="meta">（雲${b.w.obs.cloudLowMid}%${b.travel ? `・${esc(state.from.name)}から約${b.travel.totalMin}分` : `・${esc(b.s.station)}駅 徒歩${b.s.walkMin}分`}）。ほか${clear.length - 1}か所が晴れの見込み</span></div>`;
      } else {
        where = '<div class="where ng">どの候補地も雲が多い見込み。近づいたら変わるかもしれません</div>';
        cls = 'dim';
      }
    } else {
      where = `<div class="where meta">天気予報は${FORECAST_DAYS}日前から。近づいたら場所を提案します</div>`;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `proposal ${cls}`;
    b.innerHTML = `<div class="when">${md(r.night)} ${kind === 'morning' ? '翌朝 ' : ''}${hhmm(r.visStart)}〜${hhmm(r.visEnd)} <span class="meta">最大の高さ${r.maxEl.toFixed(0)}°・${dir16(r.start.az)}から${dir16(r.end.az)}へ${kind === 'morning' ? '・始発で帰る' : ''}</span></div>${where}`;
    b.addEventListener('click', () => { $('#plan [name=date]').value = r.night; runPlan().catch(showError); });
    return b;
  };
  const box = $('#proposals');
  box.replaceChildren(...ev.map((r) => item(r, 'evening')));
  $('#morningProposals').replaceChildren(...mo.map((r) => item(r, 'morning')));
  const w = windowOf(ev);
  $('#proposalsNote').textContent = ev.length
    ? `夕方に見える日が${new Set(ev.map((r) => r.night)).size}日あります。いちばん近いのは ${md(w.from)}${w.count > 1 ? `〜${md(w.to)}` : ''}。押すと観測場所を選べます。`
    : '60日以内に夕方に見える日はありません。';
}

async function init() {
  $('#figElevation').innerHTML = elevationGuideSvg();
  $('#figTwilight').innerHTML = twilightSvg();
  const dateInput = $('#plan [name=date]');
  const now = new Date();
  dateInput.value = localDate(now);
  dateInput.min = localDate(now);
  $('#status').textContent = '軌道データを取得中…';
  const [{ tle, source }, sitesJson, stationsJson, transit] = await Promise.all([
    loadTle(),
    fetch('./data/sites.json?v=e9adfac-0938').then((r) => r.json()),
    fetch('./data/stations.json?v=e9adfac-0938').then((r) => r.json()),
    loadTransit().catch((err) => { console.warn('transit data unavailable', err); return null; }),
  ]);
  state.satrec = makeSatrec(tle);
  state.sites = sitesJson.sites;
  state.stations = stationsJson.stations;
  state.transit = transit;
  const sel = $('#fromForm [name=from]');
  renderFromOptions(store.get('fromStation', ''));
  if (transit) {
    const dl = $('#stationNames');
    for (const n of [...new Set(transit.data.stations.map((s) => s.n))].sort()) { const o = document.createElement('option'); o.value = n; dl.appendChild(o); }
  }
  $('#originForm').addEventListener('submit', (e) => { e.preventDefault(); $('#originMsg').textContent = registerOrigin(new FormData(e.target).get('q') || ''); e.target.reset(); });
  sel.addEventListener('change', () => { store.set('fromStation', sel.value); readFrom(); renderProposals().catch(console.error); if (state.pass) runPlanKeepScreen().catch(showError); });
  const ep = tleEpoch(state.satrec);
  $('#tleInfo').textContent = `軌道データ: ${source}。基準時刻 ${jst(ep).toISOString().replace('T', ' ').slice(0, 16)}。基準時刻から日が離れるほど、予測時刻が数分ずれます。`
    + (transit ? ` 鉄道の経路と始発・終電は公共交通オープンデータセンター（ODPT）の路線・駅・時刻表データ（${transit.data.generated.slice(0, 10)} 取得）から計算。` : ' 鉄道データを読み込めなかったため、所要時間は距離からの概算です。');
  const obs = observer(CENTER.lat, CENTER.lon);
  state.rows = computeRows(obs, new Date(now.getTime() - 20 * 60e3), new Date(now.getTime() + DAYS * 86400e3));
  renderLists(state.rows);
  readFrom();
  $('#status').textContent = '';
  showScreen(1);
  await renderProposals();
}

// 出発駅を変えたときに、今の日付の計画を作り直す（画面は動かさない）
async function runPlanKeepScreen() {
  const plan = planForDate(state.dateKey);
  renderHeadline(state.dateKey, plan, new Date());
}

function showError(err) {
  $('#headline').innerHTML = '<span class="ng">計算に失敗しました</span>';
  $('#headlineDetail').textContent = String(err?.message ?? err);
  $('#status').textContent = '';
  console.error(err);
}

$('#plan').addEventListener('submit', (e) => { e.preventDefault(); runPlan().catch(showError); });
$('#fromForm').addEventListener('submit', (e) => e.preventDefault());
document.querySelectorAll('button[data-go]').forEach((b) => b.addEventListener('click', () => { const n = Number(b.dataset.go); if (enabledScreens.has(n)) showScreen(n); }));
$('#compassBtn').addEventListener('click', async () => {
  if (!state.sitePass) return;
  $('#compassStatus').textContent = '';
  await startCompass($('#compass'), state.sitePass, (msg) => { $('#compassStatus').textContent = msg; });
});
init().catch(showError);
