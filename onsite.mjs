// 現地でどっちを向くか: 地図に矢印（センサー不要）＋ スマホのコンパス（DeviceOrientation）
import { dir16 } from './lib/describe.mjs?v=520b9e5-0920';

const ACC = '#ffd166';

// ---- Leaflet を遅延ロード（cdnjs） ----
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error('地図ライブラリを読み込めませんでした'));
    document.head.appendChild(s);
  });
  return leafletPromise;
}

// 始点から方位 bearing[deg]・距離 m だけ進んだ地点
function destination(lat, lon, bearingDeg, meters) {
  const R = 6371000, d = meters / R, b = bearingDeg * Math.PI / 180;
  const p1 = lat * Math.PI / 180, l1 = lon * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 * 180 / Math.PI, l2 * 180 / Math.PI];
}

let map = null, layer = null;

/**
 * 観測地点の地図を描き、出現・最高・消失の方角に矢印を出す
 */
export async function showSiteMap(containerId, site, pass) {
  const L = await loadLeaflet();
  const el = document.getElementById(containerId);
  if (!map) {
    map = L.map(el, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  }
  if (layer) layer.remove();
  layer = L.layerGroup().addTo(map);
  map.setView([site.lat, site.lon], 16);
  setTimeout(() => map.invalidateSize(), 50);

  const here = L.circleMarker([site.lat, site.lon], { radius: 9, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(layer);
  here.bindTooltip('ここに立つ', { permanent: true, direction: 'bottom', className: 'tip-here' });

  const hhmm = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(11, 16);
  const arrow = (az, meters, color, label, weight) => {
    const tip = destination(site.lat, site.lon, az, meters);
    L.polyline([[site.lat, site.lon], tip], { color, weight, opacity: 0.95 }).addTo(layer);
    // 矢じり
    const l = destination(tip[0], tip[1], az + 150, meters * 0.12);
    const r = destination(tip[0], tip[1], az - 150, meters * 0.12);
    L.polygon([tip, l, r], { color, fillColor: color, fillOpacity: 1, weight: 1 }).addTo(layer);
    L.marker(tip, { icon: L.divIcon({ className: 'arrow-label', html: `<span style="border-color:${color}">${label}</span>`, iconSize: null }) }).addTo(layer);
  };
  arrow(pass.start.az, 420, ACC, `① 出現 ${hhmm(pass.start.d)}<br>${dir16(pass.start.az)}・高さ${pass.start.el.toFixed(0)}°`, 6);
  arrow(pass.peak.az, 330, '#ff9f43', `② 最高 ${hhmm(pass.peak.d)}<br>${dir16(pass.peak.az)}・高さ${pass.peak.el.toFixed(0)}°`, 5);
  if (Math.abs(((pass.end.az - pass.peak.az + 540) % 360) - 180) > 12) {
    arrow(pass.end.az, 260, '#9aa4bf', `③ 消失 ${hhmm(pass.end.d)}<br>${dir16(pass.end.az)}`, 4);
  }
  // 北向きの目印
  const n = destination(site.lat, site.lon, 0, 150);
  L.marker(n, { icon: L.divIcon({ className: 'arrow-label north', html: '<span>北</span>', iconSize: null }) }).addTo(layer);
}

// ---- コンパス（現地モード） ----
let orientationHandler = null;

function compassSvg(headingDeg, pass, now) {
  const size = 280, c = size / 2, r = 118;
  const rot = -headingDeg; // 画面の上 = 自分の向き。方位盤を逆回転
  const tick = (az, len, label) => {
    const a = (az - 90) * Math.PI / 180;
    const x1 = c + (r - len) * Math.cos(a), y1 = c + (r - len) * Math.sin(a);
    const x2 = c + r * Math.cos(a), y2 = c + r * Math.sin(a);
    const lx = c + (r - len - 14) * Math.cos(a), ly = c + (r - len - 14) * Math.sin(a);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${label ? 2 : 1}"/>`
      + (label ? `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="${label === '北' ? '#ff7b7b' : 'currentColor'}" transform="rotate(${-rot} ${lx} ${ly})">${label}</text>` : '');
  };
  let ticks = '';
  for (let az = 0; az < 360; az += 15) ticks += tick(az, az % 90 === 0 ? 14 : 7, az % 90 === 0 ? ['北', '東', '南', '西'][az / 90] : '');
  const arrow = (az, color, label) => {
    const a = (az - 90) * Math.PI / 180;
    const x2 = c + (r - 22) * Math.cos(a), y2 = c + (r - 22) * Math.sin(a);
    return `<line x1="${c}" y1="${c}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`
      + `<circle cx="${x2}" cy="${y2}" r="9" fill="${color}"/>`
      + `<text x="${x2}" y="${y2}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="#1a1400" transform="rotate(${-rot} ${x2} ${y2})">${label}</text>`;
  };
  const diff = ((pass.start.az - headingDeg + 540) % 360) - 180;
  const aligned = Math.abs(diff) < 10;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="コンパス">
<circle cx="${c}" cy="${c}" r="${r + 8}" fill="#0b1020" stroke="${aligned ? '#7ce38b' : '#243055'}" stroke-width="4"/>
<g transform="rotate(${rot} ${c} ${c})">${ticks}${arrow(pass.start.az, ACC, '①')}${arrow(pass.peak.az, '#ff9f43', '②')}</g>
<polygon points="${c},14 ${c - 9},32 ${c + 9},32" fill="${aligned ? '#7ce38b' : '#e8ecf5'}"/>
<text x="${c}" y="${c + 4}" text-anchor="middle" font-size="12" fill="currentColor">${aligned ? 'この向きでOK' : (diff > 0 ? `右へ${Math.abs(diff).toFixed(0)}°` : `左へ${Math.abs(diff).toFixed(0)}°`)}</text>
</svg>`;
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
// 日時の表示（JST）: 9/29(火) 18:19:30
function whenText(d) {
  const j = new Date(d.getTime() + 9 * 3600e3);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()}(${WD[j.getUTCDay()]}) ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')}:${String(j.getUTCSeconds()).padStart(2, '0')}`;
}
function countdownText(pass, now) {
  const fmt = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h ? `${h}時間` : ''}${m}分${String(sec).padStart(2, '0')}秒`;
  };
  if (now < pass.start.d) return `出現 ${whenText(pass.start.d)} まで あと ${fmt(pass.start.d - now)}`;
  if (now < pass.peak.d) return `見えています。最高点 ${whenText(pass.peak.d)} まで あと ${fmt(pass.peak.d - now)}`;
  if (now < pass.end.d) return `見えています。消える ${whenText(pass.end.d)} まで あと ${fmt(pass.end.d - now)}`;
  return `この通過は ${whenText(pass.end.d)} に終わりました`;
}

/**
 * コンパスを開始。戻り値は停止関数。
 */
export async function startCompass(panelEl, pass, onStatus) {
  stopCompass();
  let heading = null;
  const render = () => {
    const now = new Date();
    panelEl.innerHTML = (heading == null
      ? `<p class="muted">方位センサーの値を待っています。スマホを水平に持ち、8の字に動かしてください。</p>`
      : compassSvg(heading, pass, now))
      + `<p class="headline">${countdownText(pass, now)}</p>`
      + `<p class="small">黄色①が出現の方角、橙②が最も高くなる方角です。スマホの上（画面の上端）を①に向くまで体ごと回し、上の三角が緑になったらその方角の空、高さ${pass.start.el.toFixed(0)}°（拳${Math.max(1, Math.round(pass.start.el / 10))}つ分）を見て待ちます。</p>`;
  };
  const onOrient = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading; // iOS
    else if (e.absolute && typeof e.alpha === 'number') h = (360 - e.alpha) % 360;
    else if (typeof e.alpha === 'number') h = (360 - e.alpha) % 360; // 相対値の端末では北がずれる
    if (h != null) heading = h;
  };
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') { onStatus?.('方位センサーの利用が許可されませんでした。地図の矢印で方角を合わせてください。'); return () => {}; }
    }
  } catch {
    onStatus?.('方位センサーを使えませんでした。地図の矢印で方角を合わせてください。');
    return () => {};
  }
  const evName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(evName, onOrient);
  const timer = setInterval(render, 500);
  render();
  const noSensor = setTimeout(() => { if (heading == null) onStatus?.('方位センサーの値が取れません。パソコンや一部の端末では使えないので、地図の矢印で方角を合わせてください。'); }, 3000);
  orientationHandler = () => { window.removeEventListener(evName, onOrient); clearInterval(timer); clearTimeout(noSensor); };
  return orientationHandler;
}

export function stopCompass() {
  if (orientationHandler) { orientationHandler(); orientationHandler = null; }
}
