import { parseTle, makeSatrec, observer, iteratePasses, DEFAULT_CRITERIA } from './lib/passes.mjs';

const DAYS = 60;
const TZ = 9;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const DIRS = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
const $ = (s) => document.querySelector(s);
const jst = (d) => new Date(d.getTime() + TZ * 3600e3);
const hhmm = (d) => jst(d).toISOString().slice(11, 16);
const localDate = (d) => jst(d).toISOString().slice(0, 10);
const nightKey = (d) => localDate(new Date(d.getTime() - 12 * 3600e3)); // 正午区切りの「夜」
const md = (key) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}(${WEEKDAYS[new Date(`${key}T12:00:00+09:00`).getDay()]})`;
const localHour = (d) => jst(d).getUTCHours() + jst(d).getUTCMinutes() / 60;
const dir16 = (az) => DIRS[Math.round(az / 22.5) % 16];

async function loadTle() {
  const url = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return { tle: parseTle(await res.text()), source: 'CelesTrak（最新）' };
  } catch { /* fall through */ }
  const res = await fetch('./data/iss.tle');
  return { tle: parseTle(await res.text()), source: '同梱ファイル（CelesTrak に届かなかったため）' };
}

function tleEpoch(satrec) {
  const y = 2000 + satrec.epochyr;
  return new Date(Date.UTC(y, 0, 1) + (satrec.epochdays - 1) * 86400e3);
}

function row(r) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${md(r.night)}</td><td>${hhmm(r.visStart)}</td><td>${hhmm(r.peak)}</td><td>${hhmm(r.visEnd)}</td>`
    + `<td>${dir16(r.startAz)}→${dir16(r.peakAz)}→${dir16(r.endAz)}</td><td class="num">${r.maxEl.toFixed(0)}°</td><td class="num">${r.mag.toFixed(1)}</td>`;
  return tr;
}

function render(rows, now) {
  const ev = rows.filter((r) => r.slot === 'evening');
  const mo = rows.filter((r) => r.slot === 'morning');
  const todayKey = localDate(now); // 「今夜」= 今日の日付の夕方
  const tonight = ev.find((r) => r.night === todayKey && r.visEnd > now);
  if (tonight) {
    const r = tonight;
    $('#tonight').innerHTML = `<span class="ok">今夜は見えます</span> ${hhmm(r.visStart)}〜${hhmm(r.visEnd)}`;
    $('#tonightDetail').textContent = `${dir16(r.startAz)}から現れて${dir16(r.peakAz)}で最高${r.maxEl.toFixed(0)}°、${dir16(r.endAz)}へ。明るさ${r.mag.toFixed(1)}等。天気は別途確認してください。`;
  } else {
    $('#tonight').innerHTML = '<span class="ng">今夜は無理</span>';
    const next = ev.find((r) => r.visStart > now && r.night !== todayKey);
    $('#tonightDetail').textContent = next
      ? `次に夕方に見えるのは ${md(next.night)} ${hhmm(next.peak)} ごろ（最大仰角${next.maxEl.toFixed(0)}°）。`
      : '60日以内に夕方の条件充足パスはありません。';
  }
  const tbE = $('#evening tbody');
  tbE.replaceChildren();
  let lastNight = null;
  for (const r of ev) {
    if (lastNight && (new Date(r.night) - new Date(lastNight)) / 86400e3 > 3) {
      const gap = document.createElement('tr');
      gap.innerHTML = '<td colspan="7" class="win">次の窓</td>';
      tbE.appendChild(gap);
    }
    tbE.appendChild(row(r));
    lastNight = r.night;
  }
  $('#eveningEmpty').hidden = ev.length > 0;
  const tbM = $('#morning tbody');
  tbM.replaceChildren();
  for (const r of mo) tbM.appendChild(row(r));
}

async function run(lat, lon) {
  $('#status').textContent = 'TLE取得中…';
  $('#tonight').textContent = '計算中…';
  $('#tonightDetail').textContent = '';
  const { tle, source } = await loadTle();
  const satrec = makeSatrec(tle);
  const obs = observer(lat, lon);
  const now = new Date();
  const end = new Date(now.getTime() + DAYS * 86400e3);
  $('#status').textContent = `計算中（${DAYS}日分）…`;
  await new Promise((r) => setTimeout(r, 20)); // 先に描画させる
  const t0 = performance.now();
  const rows = [];
  // 進行中のパスも拾えるよう 20 分前から走査
  for (const p of iteratePasses(satrec, obs, new Date(now.getTime() - 20 * 60e3), end, DEFAULT_CRITERIA)) {
    if (!p.qualifies) continue;
    const v = p.visible;
    const h = localHour(v.peak.d);
    rows.push({
      night: nightKey(v.peak.d),
      slot: h >= 17 ? 'evening' : h < 6 ? 'morning' : 'other',
      visStart: v.start.d, visEnd: v.end.d, peak: v.peak.d,
      startAz: v.start.az, peakAz: v.peak.az, endAz: v.end.az,
      maxEl: v.maxElevation, mag: v.bestMagnitude,
    });
  }
  render(rows, now);
  const ep = tleEpoch(satrec);
  $('#status').textContent = `${((performance.now() - t0) / 1000).toFixed(1)}秒で計算`;
  $('#tleInfo').textContent = `TLE: ${source}、元期 ${jst(ep).toISOString().replace('T', ' ').slice(0, 16)} JST。元期から離れるほど時刻がずれます（2週間で数分）。`;
}

function showError(err) {
  $('#tonight').innerHTML = '<span class="ng">計算に失敗しました</span>';
  $('#tonightDetail').textContent = String(err?.message ?? err);
  $('#status').textContent = '';
  console.error(err);
}

$('#obs').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  run(Number(f.get('lat')), Number(f.get('lon'))).catch(showError);
});
$('#geo').addEventListener('click', () => {
  if (!navigator.geolocation) { $('#status').textContent = '位置情報が使えません'; return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    $('#obs [name=lat]').value = pos.coords.latitude.toFixed(3);
    $('#obs [name=lon]').value = pos.coords.longitude.toFixed(3);
    $('#obs').requestSubmit();
  }, () => { $('#status').textContent = '現在地を取得できませんでした'; });
});

run(35.681, 139.767).catch(showError);
