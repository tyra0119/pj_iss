import { parseTle, makeSatrec, observer, iteratePasses, DEFAULT_CRITERIA } from './lib/passes.mjs';
import { fetchHourly, assessSite, FORECAST_DAYS } from './lib/weather.mjs';
import { describePass, HOW_TO_FIND, dir16 } from './lib/describe.mjs';
import { estimateTravel, buildItinerary } from './lib/plan.mjs';
import { elevationGuideSvg, twilightSvg, observationSceneSvg } from './illustrations.mjs';
import { showSiteMap, startCompass, stopCompass } from './onsite.mjs';
import { getToken, setToken, hasAnyToken, hasBuiltinToken, lineStatuses } from './odpt.mjs';

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

const state = {
  satrec: null, sites: [], stations: [], rows: [],
  dateKey: null, pass: null, entries: [], from: null, // from: 出発地 {name, lat, lon, lines}
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
  const res = await fetch('./data/iss.tle');
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
    tr.addEventListener('click', () => { $('#plan [name=date]').value = r.night; runPlan().catch(showError); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    tbE.appendChild(tr);
    lastNight = r.night;
  }
  $('#eveningEmpty').hidden = ev.length > 0;
  const tbM = $('#morning tbody');
  tbM.replaceChildren();
  for (const r of mo) tbM.appendChild(row(r));
}

// ---------- 指定日 ----------
function planForDate(dateKey) {
  const dayStart = new Date(`${dateKey}T12:00:00+09:00`);
  const dayEnd = new Date(dayStart.getTime() + 12 * 3600e3);
  const obs = observer(CENTER.lat, CENTER.lon);
  const todays = computeRows(obs, dayStart, dayEnd).filter((r) => r.slot === 'evening');
  if (todays.length) return { todays };
  const future = computeRows(obs, dayEnd, new Date(dayEnd.getTime() + 90 * 86400e3)).filter((r) => r.slot === 'evening');
  return { todays: [], next: future[0] ?? null, nextWindow: windowOf(future) };
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
  if (plan.todays.length) {
    const r = plan.todays[0];
    const past = r.visEnd < now;
    $('#headline').innerHTML = past
      ? `<span class="ng">${label}の通過はもう終わりました</span>`
      : `<span class="ok">${label}、見えます</span> ${hhmm(r.visStart)}〜${hhmm(r.visEnd)}`;
    $('#headlineDetail').textContent = `${dir16(r.start.az)}の空に現れ、${dir16(r.peak.az)}で最も高く（${r.maxEl.toFixed(0)}°）なり、${dir16(r.end.az)}で消えます。明るさ約${r.mag.toFixed(1)}等。`;
    if (plan.todays.length > 1) {
      plan.todays.forEach((p, i) => {
        const b = document.createElement('button');
        b.textContent = `${hhmm(p.peak.d)}の通過（${p.maxEl.toFixed(0)}°）`;
        b.setAttribute('aria-pressed', String(i === 0));
        b.addEventListener('click', () => { selectPass(p); pick.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
        pick.appendChild(b);
      });
    }
    selectPass(r);
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
async function selectPass(r) {
  state.pass = r;
  $('#describe').innerHTML = describePass(r).map((t) => `<p>${t}</p>`).join('');
  $('#scene').innerHTML = observationSceneSvg(r);
  $('#howto').innerHTML = HOW_TO_FIND.map((t) => `<li>${t}</li>`).join('');
  $('#howCard').hidden = false;
  $('#sitesCard').hidden = false;
  $('#recoCard').hidden = false;
  $('#reco').innerHTML = '<p class="muted">候補地と天気を調べています…</p>';
  state.plan = null;
  $('#sites tbody').replaceChildren();

  const daysAhead = (new Date(`${state.dateKey}T12:00:00+09:00`) - new Date()) / 86400e3;
  let entries;
  let withWeather = false;
  if (daysAhead > FORECAST_DAYS - 1) {
    $('#sitesNote').textContent = `天気予報は${FORECAST_DAYS}日先までです。この日は予報がまだ無いので、雲を見ずに候補地を並べています。近づいたらもう一度調べてください。`;
    entries = state.sites.map((s) => ({ site: s, w: { available: false }, pass: sitePass(s, r) }));
  } else {
    $('#sitesNote').textContent = '天気を取得中…';
    try {
      const hourly = await fetchHourly(state.sites);
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
  // 出発地からの所要時間の目安
  for (const e of entries) e.travel = state.from ? estimateTravel(state.from, e.site) : null;
  // 並べ替え: 晴れ > 雲量 > 所要時間 > 徒歩
  const score = (e) => {
    if (!e.pass) return 1e9;
    let s = 0;
    if (withWeather && e.w.available) s += (e.w.observable ? 0 : 1000) + e.w.obs.cloudLowMid * 3;
    else s += 500;
    s += e.travel ? e.travel.totalMin : e.site.walkMin;
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

function renderSites(entries, withWeather) {
  const tb = $('#sites tbody');
  tb.replaceChildren();
  entries.forEach((e, i) => {
    const tr = document.createElement('tr');
    const cloud = e.w.available ? `${e.w.obs.cloudLowMid}%` : '予報なし';
    const obsBadge = !e.pass ? '<span class="badge ng">条件外</span>'
      : !e.w.available ? '<span class="badge">未定</span>'
        : e.w.observable ? '<span class="badge ok">晴れ</span>' : '<span class="badge ng">雲</span>';
    const warns = warnsOf(e);
    const travel = e.travel ? `約${e.travel.totalMin}分` : '—';
    tr.innerHTML = `<td class="num">${i + 1}</td>`
      + `<td class="wrap"><strong>${esc(e.site.name)}</strong><br><span class="muted small">${esc(e.site.landmark)}</span></td>`
      + `<td class="wrap">${esc(e.site.station)}駅 徒歩${e.site.walkMin}分<br><span class="muted small">${e.site.lines.map(esc).join('・')}</span></td>`
      + `<td class="num">${travel}</td>`
      + `<td class="num">${cloud}</td><td>${obsBadge}</td>`
      + `<td class="wrap small ${warns.length ? 'warn' : 'muted'}">${warns.length ? warns.join('<br>') : (e.w.available ? '特になし' : '')}</td>`
      + `<td>${e.pass ? '<button type="button" class="small">地図</button>' : ''}</td>`;
    tr.className = 'site-row';
    tr.addEventListener('click', () => selectSite(e, tr, { scroll: true }));
    tb.appendChild(tr);
  });
}

// ---------- おすすめ ----------
async function renderRecommendation(entries, withWeather) {
  const box = $('#reco');
  const good = entries.filter((e) => e.pass && (!withWeather || !e.w.available || e.w.observable));
  const best = good[0] ?? null;
  const now = new Date();
  let cloudyNote = '';
  let pickFrom = good;
  if (!best) {
    cloudyNote = `<p class="headline ng">この日はどの候補地も雲が多い見込みです</p><p class="small">予報は変わります。前日と当日の夕方にもう一度調べてください。それでも雲なら、無理に出かけないのが正解です。下は<strong>もし晴れたら</strong>の参考プランです（雲が少ない順・近い順）。</p>`;
    pickFrom = entries.filter((e) => e.pass);
  }
  const pick = best ?? pickFrom[0];
  if (!pick) { box.innerHTML = cloudyNote || '<p class="ng">この日に条件を満たす候補地がありません。</p>'; $('#onsiteCard').hidden = true; return; }
  state.plan = { good: pickFrom, withWeather, cloudyNote, best: pick };
  const tr = [...document.querySelectorAll('#sites tr.site-row')][entries.indexOf(pick)];
  return selectSite(pick, tr);
}

async function renderPlanFor(best, good, withWeather, cloudyNote, now) {
  const box = $('#reco');
  const p = best.pass;
  const isBest = state.plan && best === state.plan.best;
  const travelMin = best.travel ? best.travel.totalMin : null;
  const it = travelMin != null ? buildItinerary(p, travelMin) : null;
  const tooLate = it && it.departBy < now && state.dateKey === localDate(now);
  const reason = [];
  if (withWeather && best.w.available) reason.push(best.w.observable ? `観測時刻の雲が${best.w.obs.cloudLowMid}%と少ない` : `観測時刻の雲は${best.w.obs.cloudLowMid}%で多い`);
  if (best.travel) reason.push(`${esc(state.from.name)}から約${best.travel.totalMin}分`);
  reason.push(`${esc(best.site.station)}駅から徒歩${best.site.walkMin}分`);
  const warns = warnsOf(best);

  let timeline = '';
  if (it) {
    timeline = `<table class="timeline"><tbody>
      <tr><th>出発</th><td><strong class="${tooLate ? 'ng' : 'acc'}">${hhmm(it.departBy)} まで</strong>に${esc(state.from.name)}を出る<span class="muted small">（所要の目安 約${it.travelMin}分。時刻表で確定するまでは距離からの概算です）</span></td></tr>
      <tr><th>到着</th><td><strong>${hhmm(it.arriveBy)}</strong> までに${esc(best.site.name)}へ。方角を合わせて待つ</td></tr>
      <tr><th>観測</th><td><strong>${hhmm(it.observeFrom)}〜${hhmm(it.observeTo)}</strong>（約${Math.round((p.end.d - p.start.d) / 60e3)}分）</td></tr>
      <tr><th>帰り</th><td>${hhmm(it.leaveSite)} ごろ現地を出る。<span class="muted small">帰りの最終電車は時刻表の接続後に表示します。夕方の通過なので通常は余裕があります。</span></td></tr>
      <tr><th>帰宅</th><td><strong>${hhmm(it.returnBy)}</strong> ごろ${esc(state.from.name)}に戻る<span class="muted small">（出発から帰宅まで 約${Math.floor(it.totalMin / 60)}時間${it.totalMin % 60}分）</span></td></tr>
    </tbody></table>`
    + (tooLate ? `<p class="ng">出発の目安をもう過ぎています。次点の候補地か、今いる場所の近くで見ることを考えてください。</p>` : '');
  } else {
    timeline = `<p class="muted small">上の「出発駅」を選ぶと、出発時刻の目安と行程を出します。</p>
      <table class="timeline"><tbody>
      <tr><th>到着</th><td><strong>${hhmm(new Date(p.start.d.getTime() - 15 * 60e3))}</strong> までに${esc(best.site.name)}へ</td></tr>
      <tr><th>観測</th><td><strong>${hhmm(p.start.d)}〜${hhmm(p.end.d)}</strong></td></tr>
      </tbody></table>`;
  }
  const alts = good.filter((e) => e !== best).slice(0, 2).map((e) => `<li><button type="button" class="link" data-site="${esc(e.site.id)}">${esc(e.site.name)}</button>（${esc(e.site.station)}駅 徒歩${e.site.walkMin}分${e.w.available ? `、雲${e.w.obs.cloudLowMid}%` : ''}${e.travel ? `、約${e.travel.totalMin}分` : ''}）</li>`).join('');

  box.innerHTML = `
    ${cloudyNote}
    <p class="headline"><span class="acc">${cloudyNote ? '参考' : isBest ? 'おすすめ' : '選んだ場所'}</span> ${esc(best.site.name)}</p>
    ${!isBest && state.plan?.best ? `<p class="muted small">おすすめは ${esc(state.plan.best.site.name)} です。<button type="button" class="link" data-site="${esc(state.plan.best.site.id)}">おすすめに戻す</button></p>` : ''}
    <p class="small">${reason.join('。')}。${esc(best.site.landmark)}。</p>
    ${warns.length ? `<p class="warn small">注意: ${warns.join('、')}</p>` : ''}
    ${timeline}
    <div id="trainInfo" class="small"><span class="muted">運行情報を確認中…</span></div>
    ${alts ? `<p class="small" style="margin-top:10px">雲が流れたとき・電車が遅れたときの次点: </p><ul class="small">${alts}</ul>` : ''}
  `;
  box.querySelectorAll('button[data-site]').forEach((b) => b.addEventListener('click', () => {
    const e = state.entries.find((x) => x.site.id === b.dataset.site);
    const tr = [...document.querySelectorAll('#sites tr.site-row')][state.entries.indexOf(e)];
    selectSite(e, tr);
  }));
  await renderTrainInfo(best, good);
}

async function renderTrainInfo(best, good) {
  const el = $('#trainInfo');
  if (!el) return;
  const lines = [...new Set([...(state.from?.lines ?? []), ...best.site.lines])];
  if (!hasAnyToken()) {
    el.innerHTML = `<span class="muted">運行情報: ページ下の「運行情報の設定」で ODPT のアクセストークンを入れると、行き帰りの路線の遅れをここに表示し、遅れているときは次点の候補地に切り替えを案内します。</span>`;
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
      const alt = good.find((e) => e !== best && !e.site.lines.some((l) => delayedLines.has(l)));
      html += alt
        ? `<p>この路線を使わずに行ける次点は <button type="button" class="link" data-alt="${esc(alt.site.id)}">${esc(alt.site.name)}</button>（${esc(alt.site.station)}駅、${alt.site.lines.map(esc).join('・')}）です。出発時刻の目安が過ぎていなければそちらへ。間に合わないときは、今いる場所の近くで空の開けた所を探してください。通過の時刻と方角は同じです。</p>`
        : `<p>別路線の次点が見つかりません。復旧見込みを確認し、間に合わないときは今いる場所の近くで空の開けた所を探してください。</p>`;
    } else {
      html += `<p class="ok">運行情報: 行き帰りの路線はいま平常です（${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 時点）。出発前にもう一度この画面を開いて確かめてください。</p>`;
    }
    if (notices.length) {
      html += `<p class="warn">お知らせ: ${notices.map((s) => `${esc(s.line)}「${esc((s.text || s.status).slice(0, 80))}${(s.text || '').length > 80 ? '…' : ''}」`).join(' / ')}</p>`;
    }
    if (unsupported.length) html += `<p class="muted">運行情報に未対応の路線: ${unsupported.map(esc).join('・')}</p>`;
    el.innerHTML = html;
    el.querySelectorAll('button[data-alt]').forEach((b) => b.addEventListener('click', () => {
      const e = state.entries.find((x) => x.site.id === b.dataset.alt);
      const tr = [...document.querySelectorAll('#sites tr.site-row')][state.entries.indexOf(e)];
      selectSite(e, tr, { scroll: true });
    }));
  } catch (err) {
    el.innerHTML = `<span class="warn">運行情報を取得できませんでした（${esc(err.message)}）。トークンが正しいか確認してください。</span>`;
  }
}

// ---------- 現地 ----------
async function selectSite(e, tr, { scroll = false } = {}) {
  if (!e?.pass) return;
  state.site = e.site;
  state.sitePass = e.pass;
  if (state.plan) {
    await renderPlanFor(e, state.plan.good, state.plan.withWeather, state.plan.cloudyNote, new Date());
    if (scroll) $('#recoCard').scrollIntoView({ behavior: 'smooth' });
  }
  document.querySelectorAll('#sites tr.site-row').forEach((x) => x.classList.toggle('selected', x === tr));
  $('#onsiteCard').hidden = false;
  $('#onsiteSite').innerHTML = `<strong>${esc(e.site.name)}</strong>（${esc(e.site.station)}駅 徒歩${e.site.walkMin}分）。${esc(e.site.landmark)}。`;
  stopCompass();
  $('#compass').innerHTML = '';
  $('#compassStatus').textContent = '';
  try { await showSiteMap('map', e.site, e.pass); } catch (err) { $('#map').textContent = err.message; }
}

// ---------- 入力 ----------
function readFrom() {
  const v = $('#plan [name=from]').value;
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
  state.from = state.stations.find((s) => s.id === v) ?? null;
}

async function runPlan() {
  $('#status').textContent = '計算中…';
  state.dateKey = $('#plan [name=date]').value;
  readFrom();
  const plan = planForDate(state.dateKey);
  renderHeadline(state.dateKey, plan, new Date());
  $('#status').textContent = '';
}

async function init() {
  $('#figElevation').innerHTML = elevationGuideSvg();
  $('#figTwilight').innerHTML = twilightSvg();
  const dateInput = $('#plan [name=date]');
  const now = new Date();
  dateInput.value = localDate(now);
  dateInput.min = localDate(now);
  $('#status').textContent = '軌道データを取得中…';
  const [{ tle, source }, sitesJson, stationsJson] = await Promise.all([
    loadTle(),
    fetch('./data/sites.json').then((r) => r.json()),
    fetch('./data/stations.json').then((r) => r.json()),
  ]);
  state.satrec = makeSatrec(tle);
  state.sites = sitesJson.sites;
  state.stations = stationsJson.stations;
  const sel = $('#plan [name=from]');
  for (const s of state.stations) {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.name;
    sel.appendChild(o);
  }
  try { const saved = localStorage.getItem('fromStation'); if (saved) sel.value = saved; } catch { /* ignore */ }
  sel.addEventListener('change', () => { try { localStorage.setItem('fromStation', sel.value); } catch { /* ignore */ } });
  // 埋め込み済みなら入力欄は空のまま（上書き用）にして、その旨を表示
  $('#odptToken').value = hasBuiltinToken(0) ? '' : getToken(0);
  $('#odptChallengeToken').value = hasBuiltinToken(1) ? '' : getToken(1);
  if (hasBuiltinToken(0) || hasBuiltinToken(1)) $('#odptStatus').textContent = `設定済み（${[hasBuiltinToken(0) && '公開API', hasBuiltinToken(1) && 'チャレンジAPI'].filter(Boolean).join('・')}）。入力すると上書きできます`;
  const ep = tleEpoch(state.satrec);
  $('#tleInfo').textContent = `軌道データ: ${source}。基準時刻 ${jst(ep).toISOString().replace('T', ' ').slice(0, 16)}。基準時刻から日が離れるほど、予測時刻が数分ずれます。`;
  const obs = observer(CENTER.lat, CENTER.lon);
  state.rows = computeRows(obs, new Date(now.getTime() - 20 * 60e3), new Date(now.getTime() + DAYS * 86400e3));
  renderLists(state.rows);
  $('#status').textContent = '';
  await runPlan();
}

function showError(err) {
  $('#headline').innerHTML = '<span class="ng">計算に失敗しました</span>';
  $('#headlineDetail').textContent = String(err?.message ?? err);
  $('#status').textContent = '';
  console.error(err);
}

$('#plan').addEventListener('submit', (e) => { e.preventDefault(); runPlan().catch(showError); });
$('#compassBtn').addEventListener('click', async () => {
  if (!state.sitePass) return;
  $('#compassStatus').textContent = '';
  await startCompass($('#compass'), state.sitePass, (msg) => { $('#compassStatus').textContent = msg; });
});
$('#odptSave').addEventListener('click', () => {
  setToken($('#odptToken').value, 0);
  setToken($('#odptChallengeToken').value, 1);
  $('#odptStatus').textContent = hasAnyToken() ? '保存しました（この端末のブラウザにだけ保存されます）' : '削除しました';
  if (state.pass) runPlan().catch(showError);
});
init().catch(showError);
