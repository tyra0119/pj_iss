// ページ用の説明図（インライン SVG）。色は currentColor とアクセント色のみ

const ACC = '#ffd166';
const SKY = '#1c2a55';
const GROUND = '#2b3a2e';

// 図1: 高さ（仰角）の目安。横から見た人と、地平線からの角度
export function elevationGuideSvg() {
  const W = 640, H = 300;
  const eye = { x: 90, y: 190 };      // 目の高さ = 地平線
  const groundY = 262;                // 足元
  const ray = (deg, len, label, sub, main = false) => {
    const t = (deg * Math.PI) / 180;
    const x2 = eye.x + len * Math.cos(t), y2 = eye.y - len * Math.sin(t);
    const anchor = deg >= 60 ? 'middle' : deg === 45 ? 'end' : 'start';
    const lx = x2 + (deg >= 60 ? 0 : deg === 45 ? -10 : 8), ly = y2 - (deg >= 60 ? 22 : deg === 45 ? 6 : 0);
    return `<line x1="${eye.x}" y1="${eye.y}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${main ? ACC : 'currentColor'}" stroke-width="${main ? 3 : 1.5}" ${main ? '' : 'stroke-dasharray="4 4"'}/>`
      + `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="13" fill="${main ? ACC : 'currentColor'}" font-weight="700">${label}</text>`
      + `<text x="${lx.toFixed(1)}" y="${(ly + 15).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="currentColor" fill-opacity=".8">${sub}</text>`;
  };
  const arc = (deg, r, stroke) => {
    const t = (deg * Math.PI) / 180;
    return `<path d="M${eye.x + r},${eye.y} A${r},${r} 0 0 0 ${(eye.x + r * Math.cos(t)).toFixed(1)},${(eye.y - r * Math.sin(t)).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  };
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="高さの目安の図">
<rect x="0" y="0" width="${W}" height="${groundY}" fill="${SKY}" rx="8"/>
<rect x="0" y="${groundY}" width="${W}" height="${H - groundY}" fill="${GROUND}" rx="8"/>
<line x1="20" y1="${eye.y}" x2="${W - 20}" y2="${eye.y}" stroke="currentColor" stroke-width="1.5"/>
<text x="${W - 24}" y="${eye.y + 18}" text-anchor="end" font-size="12" fill="currentColor">地平線（0°）＝目の高さ</text>
<circle cx="${eye.x - 10}" cy="${eye.y}" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
<line x1="${eye.x - 10}" y1="${eye.y + 10}" x2="${eye.x - 10}" y2="${eye.y + 48}" stroke="currentColor" stroke-width="2"/>
<line x1="${eye.x - 10}" y1="${eye.y + 48}" x2="${eye.x - 20}" y2="${groundY}" stroke="currentColor" stroke-width="2"/>
<line x1="${eye.x - 10}" y1="${eye.y + 48}" x2="${eye.x}" y2="${groundY}" stroke="currentColor" stroke-width="2"/>
<line x1="${eye.x - 10}" y1="${eye.y + 20}" x2="${eye.x + 44}" y2="${eye.y + 8}" stroke="currentColor" stroke-width="2.5"/>
<rect x="${eye.x + 42}" y="${eye.y - 1}" width="10" height="12" rx="2" fill="${ACC}"/>
<text x="${eye.x + 58}" y="${eye.y + 24}" font-size="11" fill="currentColor" fill-opacity=".85">腕を伸ばした拳1つ＝約10°</text>
${arc(30, 70, ACC)}${arc(90, 34, 'currentColor')}
${ray(10, 300, '10°', '拳1つ。木や建物に隠れやすい')}
${ray(30, 320, '30°', '拳3つ。このアプリが出す通過の最低ライン', true)}
${ray(45, 250, '45°', '真上と地平線の真ん中')}
${ray(70, 165, '70°', '大きく見上げる')}
${ray(90, 130, '90°', '真上')}
</svg>`;
}

// 図2: 太陽高度 -8° の意味。地面は暗いが、上空の ISS にはまだ日が当たる
export function twilightSvg() {
  const W = 640, H = 300;
  const R = 720, cx = 320, cy = 205 + R; // 地球（大きな円の上端だけ見える）
  const obs = { x: cx, y: cy - R };
  const issH = 60; // 400 km 相当（誇張）
  const k = Math.tan(8 * Math.PI / 180); // 光線の傾き（右上がり 8°）
  const rayTo = (y0, x1) => `<line x1="0" y1="${y0}" x2="${x1}" y2="${(y0 - x1 * k).toFixed(1)}" stroke="${ACC}" stroke-width="2"/>`;
  // 観測者の頭上を通って ISS に届く光線 3 本
  const lit = [obs.y - issH - 36, obs.y - issH - 14, obs.y - issH + 8].map((y0) => rayTo(y0, W)).join('');
  // 観測者に向かう光線は左側で地球にぶつかる
  const yb = obs.y + 14;
  const xb = cx - Math.sqrt(Math.max(R * R - (cy - (yb - 150 * k)) * (cy - (yb - 150 * k)), 0));
  const blocked = `<line x1="0" y1="${yb + 40}" x2="${xb.toFixed(1)}" y2="${(yb + 40 - xb * k).toFixed(1)}" stroke="${ACC}" stroke-width="2" stroke-dasharray="6 5"/>`
    + `<text x="${(xb - 8).toFixed(1)}" y="${(yb + 40 - xb * k - 10).toFixed(1)}" text-anchor="end" font-size="11" fill="${ACC}">この光は地球にさえぎられ、地上には届かない</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="太陽高度マイナス8度の図">
<rect x="0" y="0" width="${W}" height="${H}" fill="${SKY}" rx="8"/>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="${GROUND}"/>
<!-- 夜側の影：観測者の地平線より下は暗い -->
<clipPath id="skyOnly"><circle cx="${cx}" cy="${cy}" r="${R + 400}"/></clipPath>
<path d="M0,${obs.y + 30 + 0} L${W},${(obs.y - (W - cx) * k + 30).toFixed(1)} L${W},${H} L0,${H} Z" fill="#000" fill-opacity=".35"/>
${lit}${blocked}
<circle cx="46" cy="${obs.y + 62}" r="24" fill="${ACC}"/>
<text x="78" y="${obs.y + 58}" font-size="12" fill="currentColor" font-weight="700">太陽</text>
<text x="78" y="${obs.y + 73}" font-size="11" fill="currentColor" fill-opacity=".85">もう沈んでいて、地平線の8°下</text>
<!-- 地平線 -->
<line x1="${cx - 230}" y1="${obs.y}" x2="${cx + 250}" y2="${obs.y}" stroke="currentColor" stroke-dasharray="4 4" stroke-opacity=".8"/>
<text x="${cx + 254}" y="${obs.y + 4}" font-size="11" fill="currentColor" fill-opacity=".9">地平線</text>
<!-- 観測者 -->
<circle cx="${obs.x}" cy="${obs.y - 18}" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
<line x1="${obs.x}" y1="${obs.y - 12}" x2="${obs.x}" y2="${obs.y + 8}" stroke="currentColor" stroke-width="2"/>
<text x="${obs.x + 12}" y="${obs.y - 4}" font-size="12" fill="currentColor" font-weight="700">あなた</text>
<text x="${obs.x + 12}" y="${obs.y + 11}" font-size="11" fill="currentColor" fill-opacity=".85">地上はもう暗い</text>
<!-- ISS -->
<g transform="translate(${obs.x + 150},${obs.y - issH - 14})">
  <rect x="-20" y="-4" width="40" height="8" fill="${ACC}"/>
  <rect x="-4" y="-10" width="8" height="20" fill="currentColor"/>
</g>
<text x="${obs.x + 178}" y="${obs.y - issH - 20}" font-size="12" fill="currentColor" font-weight="700">ISS（高さ約400 km）</text>
<text x="${obs.x + 178}" y="${obs.y - issH - 5}" font-size="11" fill="currentColor" fill-opacity=".9">まだ日が当たっている → 光って見える</text>
<text x="16" y="22" font-size="12" fill="currentColor">日没の40分ほど後。空は暗いのに、はるか上空の ISS にはまだ太陽の光が届いている。</text>
</svg>`;
}

// 図3: 観測の場面。方位を横軸、高さを縦軸にした空に、通過の軌跡と人を描く
export function observationSceneSvg(p, width = 720, height = 300) {
  const centerAz = p.peak.az;
  const half = 120;
  const horizonY = height - 50;
  const x = (az) => {
    let d = ((az - centerAz + 540) % 360) - 180;
    d = Math.max(-half, Math.min(half, d));
    return width / 2 + (d / half) * (width / 2 - 30);
  };
  const y = (el) => horizonY - (el / 90) * (horizonY - 30);
  const pts = [p.start, p.peak, p.end];
  // 3点を通る滑らかな曲線（二次ベジェ2本）
  const trk = passTrack(p);
  const samples = Array.from({ length: 41 }, (_, i) => { const q = trk.at(i / 40); return `${x(q.az).toFixed(1)},${y(q.el).toFixed(1)}`; });
  const path = samples.map((s, i) => `${i ? 'L' : 'M'}${s}`).join(' ');
  const arrows = arrowsAlong(samples, 4, '#ffd166', 8);
  const q1 = trk.at(0.12);
  const dirLabel = `<text x="${x(q1.az).toFixed(1)}" y="${(y(q1.el) + 18).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#ffd166">進む向き →</text>`;
  const dirs = [];
  for (let d = -half; d <= half; d += 30) {
    const az = (centerAz + d + 360) % 360;
    const name = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'][Math.round(az / 22.5) % 16];
    dirs.push(`<line x1="${x(az).toFixed(1)}" y1="${horizonY}" x2="${x(az).toFixed(1)}" y2="${horizonY + 6}" stroke="currentColor"/><text x="${x(az).toFixed(1)}" y="${horizonY + 20}" text-anchor="middle" font-size="12" fill="currentColor">${name}</text>`);
  }
  const fists = [10, 20, 30, 45, 60].map((el) => `<line x1="30" x2="${width - 30}" y1="${y(el).toFixed(1)}" y2="${y(el).toFixed(1)}" stroke="currentColor" stroke-opacity=".18" stroke-dasharray="3 5"/><text x="34" y="${(y(el) - 3).toFixed(1)}" font-size="10" fill="currentColor" fill-opacity=".7">${el}°${el <= 30 ? `（拳${el / 10}つ）` : el === 45 ? '（真ん中）' : ''}</text>`).join('');
  const hhmm = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(11, 16);
  const dot = (q, label, dy = -10) => `<circle cx="${x(q.az).toFixed(1)}" cy="${y(q.el).toFixed(1)}" r="5" fill="${ACC}"/><text x="${x(q.az).toFixed(1)}" y="${(y(q.el) + dy).toFixed(1)}" text-anchor="middle" font-size="12" fill="currentColor" font-weight="700">${label}</text>`;
  // 街のシルエット
  const sky = [];
  let sx = 30;
  let seed = 7;
  while (sx < width - 30) {
    seed = (seed * 9301 + 49297) % 233280;
    const w = 14 + (seed % 26); const h = 6 + (seed % 22);
    sky.push(`<rect x="${sx}" y="${horizonY - h}" width="${w}" height="${h}" fill="#0b1020" fill-opacity=".9"/>`);
    sx += w + 4;
  }
  const px = width / 2;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="観測の場面の図">
<rect x="0" y="0" width="${width}" height="${horizonY}" fill="${SKY}" rx="8"/>
<rect x="0" y="${horizonY}" width="${width}" height="${height - horizonY}" fill="${GROUND}" rx="8"/>
${fists}
${sky.join('')}
<line x1="30" x2="${width - 30}" y1="${horizonY}" y2="${horizonY}" stroke="currentColor" stroke-width="1.5"/>
<path d="${path}" fill="none" stroke="${ACC}" stroke-width="3" stroke-dasharray="8 6"/>${arrows}${dirLabel}
${dot(p.start, `① 出現 ${hhmm(p.start.d)}`)}${dot(p.peak, `② 最高 ${hhmm(p.peak.d)}・${p.peak.el.toFixed(0)}°`, -12)}${dot(p.end, `③ 消失 ${hhmm(p.end.d)}`, Math.abs(x(p.end.az) - x(p.peak.az)) < 70 && Math.abs(y(p.end.el) - y(p.peak.el)) < 30 ? 22 : -10)}
<!-- 人（背中側から） -->
<circle cx="${px}" cy="${horizonY - 6}" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
<line x1="${px}" y1="${horizonY + 1}" x2="${px}" y2="${horizonY + 22}" stroke="currentColor" stroke-width="2"/>
<line x1="${px - 12}" y1="${horizonY + 8}" x2="${px + 12}" y2="${horizonY + 8}" stroke="currentColor" stroke-width="2"/>
<text x="${px}" y="${horizonY + 44}" text-anchor="middle" font-size="12" fill="currentColor">あなた（${['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'][Math.round(centerAz / 22.5) % 16]}を向いて立つ）</text>
${dirs.join('')}
<text x="${width - 34}" y="22" text-anchor="end" font-size="11" fill="currentColor" fill-opacity=".8">左右：向く方角　上下：見上げる高さ</text>
</svg>`;
}


// 図4: 自分視点。出現の方角を正面にして立ち、腕を伸ばして拳を積んだときの見え方
// 横 90°・縦 0〜60° の視野。opts で「いまの光の位置」「顔の向き」を受け取り、アニメーションにも使う
const DIRS16 = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
const dir16 = (az) => DIRS16[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
const hhmm = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(11, 16);
const hhmmss = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(11, 19);

/**
 * 観測者から見た ISS の軌跡。ISS は高さ約 420 km を直線的に飛ぶとみなし、
 * 「最高点の方向・距離」と「出現の方向・時刻」から速度と進行方向を決めて、任意の時刻の方角・高さを出す。
 * 空の上では戻らず、ほぼ大円に沿って進む。t は 0（出現）..1（消失）
 */
// 点列（"x,y" の並び）に沿って、進む向きの矢じりを n 個置く
export function arrowsAlong(points, n = 3, color = '#ffd166', size = 9) {
  const pts = points.map((s) => s.split(',').map(Number));
  if (pts.length < 3) return '';
  let out = '';
  for (let k = 1; k <= n; k++) {
    const i = Math.min(pts.length - 2, Math.max(1, Math.round((pts.length - 1) * k / (n + 1))));
    const [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
    const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
    out += `<polygon points="${size},0 ${-size * 0.7},${size * 0.6} ${-size * 0.7},${-size * 0.6}" fill="${color}" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${ang.toFixed(1)})"/>`;
  }
  return out;
}

export function passTrack(p) {
  const D = Math.PI / 180;
  const unit = (az, el) => [Math.cos(el * D) * Math.sin(az * D), Math.cos(el * D) * Math.cos(az * D), Math.sin(el * D)]; // 東, 北, 上
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => Math.hypot(a[0], a[1], a[2]);
  const H = 420; // km
  const up = unit(p.peak.az, p.peak.el);
  const dPeak = H / Math.max(Math.sin(p.peak.el * D), 0.05); // 最高点での距離（地球の丸みは無視）
  const Pp = up.map((c) => c * dPeak);
  // 基準点（出現 or 消失）の方向から、進行方向と速さを決めた直線モデル
  const model = (ref) => {
    const us = unit(ref.az, ref.el);
    const cosang = Math.max(dot(us, up), 0.05);
    const lambda = dPeak / cosang;
    const w = [us[0] * lambda - Pp[0], us[1] * lambda - Pp[1], us[2] * lambda - Pp[2]]; // 最高点→基準点
    const len = norm(w) || 1;
    const sign = ref.d < p.peak.d ? -1 : 1;
    const uv = w.map((c) => (c / len) * sign);
    const v = len / Math.max(Math.abs(ref.d - p.peak.d) / 1000, 1);
    return (date) => {
      const sec = (date - p.peak.d) / 1000;
      const P = [Pp[0] + uv[0] * v * sec, Pp[1] + uv[1] * v * sec, Pp[2] + uv[2] * v * sec];
      return { az: (Math.atan2(P[0], P[1]) / D + 360) % 360, el: Math.max(0, Math.atan2(P[2], Math.hypot(P[0], P[1])) / D) };
    };
  };
  const okS = Math.abs(p.start.d - p.peak.d) > 5000, okE = Math.abs(p.end.d - p.peak.d) > 5000;
  const mS = model(okS ? p.start : p.end), mE = model(okE ? p.end : p.start);
  const durMs = p.end.d - p.start.d;
  // 出現側のモデルと消失側のモデルを、時間の割合で混ぜる（両端は正確、途中は滑らか）
  const at = (t) => {
    const date = new Date(p.start.d.getTime() + t * durMs);
    const a = mS(date), b = mE(date);
    const w = okS && okE ? t : (okS ? 0 : 1);
    const dAz = ((b.az - a.az + 540) % 360) - 180;
    return { az: (a.az + dAz * w + 360) % 360, el: a.el + (b.el - a.el) * w, d: date };
  };
  return { at, durMs };
}

export function firstPersonSvg(p, opts = {}, width = 720, height = 420) {
  const track = passTrack(p);
  const t = Math.max(0, Math.min(1, opts.t ?? 0));
  const pos = track.at(t);
  const centerAz = opts.centerAz ?? p.start.az;
  const halfFov = 45, maxEl = 90; // 縦は地平線から真上まで
  const horizonY = height - 96;
  const relTo = (az) => ((az - centerAz + 540) % 360) - 180;
  const x = (az) => { const d = Math.max(-halfFov - 20, Math.min(halfFov + 20, relTo(az))); return width / 2 + (d / halfFov) * (width / 2 - 24); };
  const y = (el) => horizonY - (Math.min(el, maxEl) / maxEl) * (horizonY - 28);
  // 方位の目盛り（15°ごと、顔の向きに合わせて流れる）
  let ticks = '';
  const base = Math.round(centerAz / 15) * 15;
  for (let d = -60; d <= 60; d += 15) {
    const az = (base + d + 360) % 360;
    const r = relTo(az);
    if (Math.abs(r) > halfFov + 6) continue;
    const major = az % 45 === 0;
    ticks += `<line x1="${x(az).toFixed(1)}" y1="${horizonY}" x2="${x(az).toFixed(1)}" y2="${horizonY + (major ? 10 : 6)}" stroke="currentColor" stroke-opacity=".8"/>` + (major ? `<text x="${x(az).toFixed(1)}" y="${horizonY + 26}" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity=".85">${dir16(az)}</text>` : '');
  }
  // 遠景（木・建物）。顔の向きで流れるように、方位に固定して描く
  let sky = '';
  for (let i = 0; i < 48; i++) {
    const az = i * 7.5, seed = (i * 9301 + 49297) % 233280;
    const r = relTo(az); if (Math.abs(r) > halfFov + 8) continue;
    const w = 18 + (seed % 40), h = 8 + (seed % 26), cx = x(az);
    sky += seed % 3 === 0 ? `<ellipse cx="${cx.toFixed(1)}" cy="${horizonY - h / 2}" rx="${w / 2}" ry="${h / 2 + 4}" fill="#0b1020"/>` : `<rect x="${(cx - w / 2).toFixed(1)}" y="${horizonY - h}" width="${w}" height="${h}" fill="#0b1020"/>`;
  }
  // 拳の積み重ね（10°ごと）: 正面の手前。いま見ている高さまで積む
  const fists = Math.max(1, Math.min(6, Math.round((t === 0 ? p.start.el : pos.el) / 10)));
  const fistW = 44, armX = width / 2;
  let hand = `<path d="M${armX - 26},${height} L${armX - 18},${horizonY + 10} L${armX + 18},${horizonY + 10} L${armX + 26},${height} Z" fill="#1a2440" stroke="#3c5a8a" stroke-width="1.5"/>`;
  for (let i = 0; i < fists; i++) {
    const top = y((i + 1) * 10), bottom = y(i * 10);
    hand += `<rect x="${armX - fistW / 2}" y="${top + 2}" width="${fistW}" height="${Math.max(6, bottom - top - 4)}" rx="9" fill="#243055" stroke="#5f7bb0" stroke-width="1.5" fill-opacity=".92"/>`
      + `<text x="${armX + fistW / 2 + 8}" y="${((top + bottom) / 2 + 4).toFixed(1)}" font-size="12" fill="currentColor" fill-opacity=".85">拳${i + 1}つ＝${(i + 1) * 10}°</text>`;
  }
  // 軌跡: 通った分は実線、これから通る分は点線
  const pts = (from, to, n) => { const a = []; for (let i = 0; i <= n; i++) { const q = track.at(from + (to - from) * (i / n)); a.push(`${x(q.az).toFixed(1)},${y(q.el).toFixed(1)}`); } return a.join(' '); };
  const done = t > 0 ? `<polyline points="${pts(0, t, 40)}" fill="none" stroke="#ffd166" stroke-width="3" opacity=".9"/>` : '';
  const todoPts = pts(t, 1, 40).split(' ');
  const todo = t < 1 ? `<polyline points="${todoPts.join(' ')}" fill="none" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="7 7" opacity=".75"/>${arrowsAlong(todoPts, Math.max(1, Math.round(3 * (1 - t))), '#ffd166', 8)}` : '';
  const sx = x(pos.az), sy = y(pos.el);
  const startMark = t > 0.02 ? `<circle cx="${x(p.start.az).toFixed(1)}" cy="${y(p.start.el).toFixed(1)}" r="7" fill="none" stroke="#ffd166" stroke-opacity=".7" stroke-dasharray="3 3"/>` : '';
  const label = t === 0 ? `ここに現れる ${hhmm(p.start.d)}` : t >= 1 ? `ここで消える ${hhmm(p.end.d)}` : `${hhmmss(pos.d)}`;
  const sub = t === 0 ? `${dir16(p.start.az)}・拳${Math.max(1, Math.round(p.start.el / 10))}つ分（${p.start.el.toFixed(0)}°）` : `${dir16(pos.az)}・高さ${pos.el.toFixed(0)}°${pos.el >= 60 ? '（大きく見上げる）' : ''}`;
  const turn = relTo(p.start.az);
  const head = Math.abs(turn) < 3 ? `正面を ${dir16(centerAz)} に向けて立ち、腕をまっすぐ伸ばして拳を積む` : `顔を${turn < 0 ? '右' : '左'}へ ${Math.abs(turn).toFixed(0)}° 回して追いかける（いま ${dir16(centerAz)} を向いている）`;
  const offTop = pos.el > maxEl ? `<polygon points="${sx.toFixed(1)},14 ${(sx - 10).toFixed(1)},32 ${(sx + 10).toFixed(1)},32" fill="#ffd166"/><text x="${sx.toFixed(1)}" y="46" text-anchor="middle" font-size="12" fill="#ffd166">もっと上（${pos.el.toFixed(0)}°）</text>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="自分の目から見た空の見え方">
<defs><radialGradient id="fpGlow"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
<linearGradient id="fpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a4a"/><stop offset="1" stop-color="#2a3d6e"/></linearGradient>
<clipPath id="fpClip"><rect x="0" y="0" width="${width}" height="${height}" rx="8"/></clipPath></defs>
<g clip-path="url(#fpClip)">
<rect x="0" y="0" width="${width}" height="${horizonY}" fill="url(#fpSky)"/>
<rect x="0" y="${horizonY}" width="${width}" height="${height - horizonY}" fill="#182233"/>
<g fill="#fff" opacity=".7"><circle cx="${x(centerAz - 30).toFixed(1)}" cy="60" r="1.3"/><circle cx="${x(centerAz - 12).toFixed(1)}" cy="110" r="1"/><circle cx="${x(centerAz + 5).toFixed(1)}" cy="50" r="1.4"/><circle cx="${x(centerAz + 22).toFixed(1)}" cy="90" r="1.1"/><circle cx="${x(centerAz + 38).toFixed(1)}" cy="40" r="1.3"/><circle cx="${x(centerAz - 40).toFixed(1)}" cy="150" r="1"/></g>
${sky}
<line x1="0" x2="${width}" y1="${horizonY}" y2="${horizonY}" stroke="currentColor" stroke-width="1.5"/>
${ticks}
${todo}${done}${startMark}
${hand}
${pos.el <= maxEl ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="26" fill="url(#fpGlow)"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="#fff"/>
<text x="${sx.toFixed(1)}" y="${(sy - 34).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="#ffd166">${label}</text>
<text x="${sx.toFixed(1)}" y="${(sy - 18).toFixed(1)}" text-anchor="middle" font-size="12" fill="currentColor">${sub}</text>` : offTop}
<text x="16" y="22" font-size="12" fill="currentColor" fill-opacity=".85">あなたの目から見た空（横 90°・上は真上まで）。明るい星のような光が、点滅せず、すべるように動く</text>
<text x="16" y="42" font-size="13" fill="currentColor" font-weight="700">${head}</text>
</g>
</svg>`;
}


// 図5: 後ろ斜め上から見た「あなたと空のドーム」。地平線の輪、方角、頭上へ向かう軌跡、指さす腕
// opts: { t, centerAz }（firstPersonSvg と同じ）
export function domeViewSvg(p, opts = {}, width = 720, height = 460) {
  const D = Math.PI / 180;
  const track = passTrack(p);
  const t = Math.max(0, Math.min(1, opts.t ?? 0));
  const pos = track.at(t);
  const centerAz = opts.centerAz ?? p.start.az;      // 正面（奥）にする方角
  // 3D: x=右, y=奥, z=上。空は半径 1 の半球
  const P3 = (az, el, r = 1) => { const a = (az - centerAz) * D, e = el * D; return [r * Math.cos(e) * Math.sin(a), r * Math.cos(e) * Math.cos(a), r * Math.sin(e)]; };
  // カメラ: 観測者の後ろ 1.9、高さ 0.55 から、少し上向きに見る
  const E = [0, -2.3, 1.0], F = [0, 0.25, 0.55];
  const f = (() => { const d = [F[0] - E[0], F[1] - E[1], F[2] - E[2]]; const n = Math.hypot(...d); return d.map((c) => c / n); })();
  const rgt = [1, 0, 0];
  const up = [-(f[1] * rgt[2] - f[2] * rgt[1]), -(f[2] * rgt[0] - f[0] * rgt[2]), -(f[0] * rgt[1] - f[1] * rgt[0])]; // rgt × f
  const focal = 1.3;
  const proj = (P) => { const d = [P[0] - E[0], P[1] - E[1], P[2] - E[2]]; const zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (zc < 0.08) return null; const xc = d[0] * rgt[0] + d[1] * rgt[1] + d[2] * rgt[2]; const yc = d[0] * up[0] + d[1] * up[1] + d[2] * up[2]; return [width / 2 + (xc / zc) * focal * width / 2, height * 0.47 - (yc / zc) * focal * width / 2]; };
  const S = (az, el, r) => proj(P3(az, el, r));
  const poly = (pts, attrs) => { const seg = []; let cur = []; for (const q of pts) { if (!q) { if (cur.length) seg.push(cur); cur = []; } else cur.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`); } if (cur.length) seg.push(cur); return seg.map((s) => `<polyline points="${s.join(' ')}" ${attrs}/>`).join(''); };
  // 地平線の輪と、高さの輪（30°・60°）、正面の子午線
  const ring = (el, attrs) => poly(Array.from({ length: 73 }, (_, i) => S(centerAz + i * 5 - 180, el)), attrs);
  const horizon = ring(0, 'fill="none" stroke="currentColor" stroke-width="1.6"');
  const rings = ring(30, 'fill="none" stroke="currentColor" stroke-opacity=".22" stroke-dasharray="3 5"') + ring(60, 'fill="none" stroke="currentColor" stroke-opacity=".18" stroke-dasharray="3 5"');
  const meridian = poly(Array.from({ length: 37 }, (_, i) => S(centerAz, i * 5)).concat(Array.from({ length: 36 }, (_, i) => S(centerAz + 180, 90 - (i + 1) * 5))), 'fill="none" stroke="currentColor" stroke-opacity=".15"');
  // 地面（地平線の輪の内側）: 輪の多角形を塗る
  const groundPts = Array.from({ length: 73 }, (_, i) => S(centerAz + i * 5 - 180, 0)).filter(Boolean).map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  // 方角ラベル（地平線の少し外側）
  const DIRS8 = [['北', 0], ['北東', 45], ['東', 90], ['南東', 135], ['南', 180], ['南西', 225], ['西', 270], ['北西', 315]];
  let labels = '';
  for (const [n, az] of DIRS8) { const q = S(az, 0, 1.12); if (!q || q[1] > height - 8) continue; const front = Math.cos((az - centerAz) * D) < 0; labels += `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="middle" font-size="${front ? 13 : 11}" font-weight="${front ? 700 : 400}" fill="currentColor" fill-opacity="${front ? 1 : .6}">${n}</text>`; }
  // 高さの目安ラベル（正面の子午線上）
  let elLabels = '';
  for (const el of [30, 60]) { const q = S(centerAz + 40, el); if (q) elLabels += `<text x="${(q[0] + 8).toFixed(1)}" y="${(q[1] - 4).toFixed(1)}" font-size="11" fill="currentColor" fill-opacity=".7">${el}°${el === 30 ? '（拳3つ）' : ''}</text>`; }
  const zen = S(0, 89.9); const Lq = S(pos.az, pos.el); const zenLabel = zen && !(Lq && Math.hypot(Lq[0] - zen[0], Lq[1] - zen[1]) < 60) ? `<text x="${zen[0].toFixed(1)}" y="${(zen[1] - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity=".7">真上</text>` : '';
  // 軌跡: 通った分は実線、これからは点線＋矢じり
  const seq = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => { const q = track.at(a + (b - a) * i / n); return S(q.az, q.el); });
  const donePts = t > 0 ? seq(0, t, 40) : [];
  const todoPts = t < 1 ? seq(t, 1, 40) : [];
  const todoStr = todoPts.filter(Boolean).map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`);
  const done = donePts.length ? poly(donePts, 'fill="none" stroke="#ffd166" stroke-width="3.5" stroke-linecap="round"') : '';
  const todo = todoPts.length ? poly(todoPts, 'fill="none" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="7 7" opacity=".8"') + arrowsAlong(todoStr, Math.max(1, Math.round(3 * (1 - t))), '#ffd166', 8) : '';
  // 観測者（原点に立つ、後ろ姿）と、光を指さす腕
  const H = 0.26; // 人の背の高さ（ドーム半径 1 に対して）
  const head = proj([0, 0, H]), hip = proj([0, 0, H * 0.45]), shoulder = proj([0, 0, H * 0.8]);
  const footL = proj([-0.035, 0, 0]), footR = proj([0.035, 0, 0]), foot = proj([0, 0, 0]);
  const arm = (() => { const P = P3(pos.az, pos.el, 1); const L = H * 0.75; const v = [P[0], P[1], P[2] - H * 0.8]; const n = Math.hypot(...v); return proj([v[0] / n * L, v[1] / n * L, H * 0.8 + v[2] / n * L]); })();
  const person = head && hip && footL && footR ? `<line x1="${shoulder[0].toFixed(1)}" y1="${shoulder[1].toFixed(1)}" x2="${hip[0].toFixed(1)}" y2="${hip[1].toFixed(1)}" stroke="#e8ecf5" stroke-width="9" stroke-linecap="round"/><line x1="${hip[0].toFixed(1)}" y1="${hip[1].toFixed(1)}" x2="${footL[0].toFixed(1)}" y2="${footL[1].toFixed(1)}" stroke="#e8ecf5" stroke-width="5" stroke-linecap="round"/><line x1="${hip[0].toFixed(1)}" y1="${hip[1].toFixed(1)}" x2="${footR[0].toFixed(1)}" y2="${footR[1].toFixed(1)}" stroke="#e8ecf5" stroke-width="5" stroke-linecap="round"/><circle cx="${head[0].toFixed(1)}" cy="${head[1].toFixed(1)}" r="9" fill="#e8ecf5"/>${arm ? `<line x1="${shoulder[0].toFixed(1)}" y1="${shoulder[1].toFixed(1)}" x2="${arm[0].toFixed(1)}" y2="${arm[1].toFixed(1)}" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>` : ''}<text x="${(foot[0] + 16).toFixed(1)}" y="${(foot[1] + 6).toFixed(1)}" font-size="12" fill="currentColor">あなた</text>` : '';
  // 光
  const L = S(pos.az, pos.el);
  const startQ = S(p.start.az, p.start.el);
  const startMark = t > 0.02 && startQ ? `<circle cx="${startQ[0].toFixed(1)}" cy="${startQ[1].toFixed(1)}" r="6" fill="none" stroke="#ffd166" stroke-opacity=".7" stroke-dasharray="3 3"/>` : '';
  const label = t === 0 ? `ここに現れる ${hhmm(p.start.d)}` : t >= 1 ? `ここで消える ${hhmm(p.end.d)}` : hhmmss(pos.d);
  const sub = t === 0 ? `${dir16(p.start.az)}・拳${Math.max(1, Math.round(p.start.el / 10))}つ分（${p.start.el.toFixed(0)}°）` : `${dir16(pos.az)}・高さ${pos.el.toFixed(0)}°`;
  const ly = L ? Math.max(48, L[1] - 20) : 0; // ラベルは光の上。上端からはみ出さない
  const light = L ? `<circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="24" fill="url(#dmGlow)"/><circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="5" fill="#fff"/><text x="${L[0].toFixed(1)}" y="${(ly - 18).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="#ffd166" stroke="#0b1230" stroke-width="3" paint-order="stroke">${label}</text><text x="${L[0].toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="12" fill="currentColor" stroke="#0b1230" stroke-width="3" paint-order="stroke">${sub}</text>` : '';
  // 星
  let stars = '';
  for (let i = 0; i < 26; i++) { const q = S((i * 47) % 360, 8 + (i * 29) % 70); if (q) stars += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${1 + (i % 3) * 0.4}" fill="#fff" opacity=".6"/>`; }
  const turn = ((p.start.az - centerAz + 540) % 360) - 180;
  const headTxt = Math.abs(turn) < 3 ? `${dir16(centerAz)} を向いて立つ。空を、あなたの後ろ斜め上から見た図` : `顔を${turn < 0 ? '右' : '左'}へ ${Math.abs(turn).toFixed(0)}° 回して追いかける（いま ${dir16(centerAz)} を向いている）`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="あなたと空のドームを後ろ斜め上から見た図">
<defs><radialGradient id="dmGlow"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
<linearGradient id="dmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070f2a"/><stop offset="1" stop-color="#1c2c58"/></linearGradient></defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="url(#dmSky)" rx="8"/>
${stars}
<polygon points="${groundPts}" fill="#182233" fill-opacity=".95"/>
${rings}${meridian}${horizon}${labels}${elLabels}${zenLabel}
${todo}${done}${startMark}
${person}
${light}
<text x="16" y="22" font-size="12" fill="currentColor" fill-opacity=".85">${headTxt}</text>
</svg>`;
}
