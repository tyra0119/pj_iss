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

export function firstPersonSvg(p, opts = {}, width = 720, height = 440) {
  const track = passTrack(p);
  const t = Math.max(0, Math.min(1, opts.t ?? 0));
  const pos = track.at(t);
  const halfFov = 45, maxEl = 90;                    // 横 90°、縦は地平線から真上まで
  const centerAz = (() => {                          // 顔の向き（光をゆっくり追いかける）。光が画面から出ないよう ±40° に収める
    const c = opts.centerAz ?? p.start.az;
    const r = ((pos.az - c + 540) % 360) - 180;
    return Math.abs(r) <= 40 ? c : (c + r - Math.sign(r) * 40 + 360) % 360;
  })();
  const horizonY = height - 110;
  const relTo = (az) => ((az - centerAz + 540) % 360) - 180;
  const inView = (az) => Math.abs(relTo(az)) <= halfFov + 4;
  const x = (az) => { const d = Math.max(-halfFov - 20, Math.min(halfFov + 20, relTo(az))); return width / 2 + (d / halfFov) * (width / 2 - 24); };
  const y = (el) => horizonY - (Math.min(el, maxEl) / maxEl) * (horizonY - 60);
  // 方位の目盛り（15°ごと。顔の向きに合わせて流れる）
  let ticks = '';
  const base = Math.round(centerAz / 15) * 15;
  for (let d = -60; d <= 60; d += 15) {
    const az = (base + d + 360) % 360;
    if (!inView(az)) continue;
    const major = az % 45 === 0;
    ticks += `<line x1="${x(az).toFixed(1)}" y1="${horizonY}" x2="${x(az).toFixed(1)}" y2="${horizonY + (major ? 10 : 6)}" stroke="currentColor" stroke-opacity=".8"/>` + (major ? `<text x="${x(az).toFixed(1)}" y="${horizonY + 26}" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" fill-opacity=".9">${dir16(az)}</text>` : '');
  }
  // 高さの目安線（30°・60°）
  const elLines = [30, 60].map((el) => `<line x1="0" x2="${width}" y1="${y(el).toFixed(1)}" y2="${y(el).toFixed(1)}" stroke="#9fb4e8" stroke-opacity=".25" stroke-dasharray="4 6"/><text x="${width - 8}" y="${(y(el) - 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#9fb4e8">高さ${el}°（拳${el / 10}つ）</text>`).join('');
  // 遠景（木・建物）。方位に固定して描く
  let sky = '';
  for (let i = 0; i < 48; i++) {
    const az = i * 7.5, seed = (i * 9301 + 49297) % 233280;
    if (!inView(az)) continue;
    const w = 18 + (seed % 40), h = 8 + (seed % 26), cx = x(az);
    sky += seed % 3 === 0 ? `<ellipse cx="${cx.toFixed(1)}" cy="${horizonY - h / 2}" rx="${w / 2}" ry="${h / 2 + 4}" fill="#0b1020"/>` : `<rect x="${(cx - w / 2).toFixed(1)}" y="${horizonY - h}" width="${w}" height="${h}" fill="#0b1020"/>`;
  }
  // 腕と拳: 光の方へ腕を伸ばし、光の高さまで拳を積む（拳 1 つ ≒ 10°）
  const targetAz = t === 0 ? p.start.az : pos.az, targetEl = t === 0 ? p.start.el : pos.el;
  const fists = Math.max(1, Math.min(9, Math.round(targetEl / 10)));
  const fistW = 40, armX = Math.max(70, Math.min(width - 70, x(targetAz)));
  let hand = `<path d="M${width / 2 - 30},${height} L${(armX - 16).toFixed(1)},${horizonY + 14} L${(armX + 16).toFixed(1)},${horizonY + 14} L${width / 2 + 30},${height} Z" fill="#1a2440" stroke="#3c5a8a" stroke-width="1.5"/>`;
  for (let i = 0; i < fists; i++) {
    const top = y((i + 1) * 10), bottom = y(i * 10);
    hand += `<rect x="${(armX - fistW / 2).toFixed(1)}" y="${(top + 2).toFixed(1)}" width="${fistW}" height="${Math.max(6, bottom - top - 4).toFixed(1)}" rx="9" fill="#243055" stroke="#5f7bb0" stroke-width="1.5" fill-opacity=".92"/>`;
  }
  const usedRects = []; // 文字の矩形 [x0,y0,x1,y1]。重なりを避けるのに使う
  const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const textRect = (tx, ty, anchor, w) => (anchor === 'middle' ? [tx - w / 2, ty - 14, tx + w / 2, ty + 4] : anchor === 'start' ? [tx, ty - 14, tx + w, ty + 4] : [tx - w, ty - 14, tx, ty + 4]);
  // 道筋: 通った分は実線、これからは点線＋矢じり
  const pts = (from, to, n) => { const a = []; for (let i = 0; i <= n; i++) { const q = track.at(from + (to - from) * (i / n)); a.push(`${x(q.az).toFixed(1)},${y(q.el).toFixed(1)}`); } return a.join(' '); };
  const done = t > 0 ? `<polyline points="${pts(0, t, 40)}" fill="none" stroke="#ffd166" stroke-width="3.5" opacity=".9"/>` : '';
  const todoPts = pts(t, 1, 40).split(' ');
  const todo = t < 1 ? `<polyline points="${todoPts.join(' ')}" fill="none" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="7 7" opacity=".75"/>${arrowsAlong(todoPts, Math.max(1, Math.round(3 * (1 - t))), '#ffd166', 8)}` : '';
  // ①②③ の印。画面の外なら端に「この先」の印
  const edgeUsed = { left: [], right: [] };
  const mark = (az, el, n, text, place) => {
    if (inView(az) && el <= maxEl) {
      const qx = x(az), qy = y(el);
      const side = place === 'above' ? 'middle' : qx < width / 2 ? 'start' : 'end'; // 端で切れないよう、中央寄りに文字を出す
      const tx = place === 'above' ? qx : qx + (side === 'start' ? 14 : -14), ty = place === 'above' ? qy - 16 : qy + 4;
      usedRects.push(textRect(tx, ty, side, text.length * 12));
      return `<circle cx="${qx.toFixed(1)}" cy="${qy.toFixed(1)}" r="9" fill="#ffd166"/><text x="${qx.toFixed(1)}" y="${(qy + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="#1a1400">${n}</text><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${side}" font-size="12" font-weight="700" fill="#ffd166" stroke="#0b1230" stroke-width="3" paint-order="stroke">${text}</text>`;
    }
    const r = relTo(az), left = r < 0, ex = left ? 14 : width - 14;
    let ey = Math.max(70, Math.min(horizonY - 14, y(Math.min(el, maxEl))));
    const used = edgeUsed[left ? 'left' : 'right'];
    while (used.some((u) => Math.abs(u - ey) < 18)) ey += 18; // 同じ側の印が重なるときは下にずらす
    used.push(ey);
    usedRects.push(textRect(ex, ey, left ? 'start' : 'end', 110));
    return `<text x="${ex}" y="${ey.toFixed(1)}" text-anchor="${left ? 'start' : 'end'}" font-size="12" font-weight="700" fill="#ffd166" fill-opacity=".85">${left ? '◀ ' : ''}${n} ${left ? '左' : '右'}へ ${Math.abs(r).toFixed(0)}°${left ? '' : ' ▶'}</text>`;
  };
  const marks = mark(p.start.az, p.start.el, '①', `現れる ${hhmm(p.start.d)}`, 'side') + mark(p.peak.az, p.peak.el, '②', `最も高い ${hhmm(p.peak.d)}・${p.peak.el.toFixed(0)}°`, 'above') + mark(p.end.az, p.end.el, '③', `消える ${hhmm(p.end.d)}`, 'side');
  // 光（いまの位置）
  const sx = x(pos.az), sy = y(pos.el);
  const nowLabel = t > 0 && t < 1 ? `${hhmmss(pos.d)}　${dir16(pos.az)}・高さ${pos.el.toFixed(0)}°` : '';
  const nearPeak = Math.hypot(x(p.peak.az) - sx, y(p.peak.el) - sy) < 70;
  if (nowLabel && pos.el <= maxEl) usedRects.push(textRect(sx, nearPeak ? sy + 44 : sy - 34, 'middle', nowLabel.length * 12));
  const fistText = `拳${fists}つ分（約${fists * 10}°）`;
  const fistY = y(fists * 10 - 5) + 4;
  const fistCands = [[armX + fistW / 2 + 8, 'start'], [armX - fistW / 2 - 8, 'end']];
  const fistPick = fistCands.map((c) => { const r = textRect(c[0], fistY, c[1], fistText.length * 12); const off = r[0] < 4 || r[2] > width - 4 ? 1e5 : 0; return [c, off + usedRects.reduce((sum, u) => sum + overlap(r, u), 0)]; }).sort((a, b) => a[1] - b[1])[0][0]; // 画面から出る側は使わない
  const fistLabel = `<text x="${fistPick[0].toFixed(1)}" y="${fistY.toFixed(1)}" text-anchor="${fistPick[1]}" font-size="12" font-weight="700" fill="currentColor" stroke="#0b1230" stroke-width="3" paint-order="stroke">${fistText}</text>`;
  const light = pos.el <= maxEl
    ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="26" fill="url(#fpGlow)"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5.5" fill="#fff"/>${nowLabel ? `<text x="${sx.toFixed(1)}" y="${(nearPeak ? sy + 44 : sy - 34).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" stroke="#0b1230" stroke-width="3" paint-order="stroke">${nowLabel}</text>` : ''}`
    : `<polygon points="${sx.toFixed(1)},54 ${(sx - 10).toFixed(1)},72 ${(sx + 10).toFixed(1)},72" fill="#ffd166"/><text x="${sx.toFixed(1)}" y="86" text-anchor="middle" font-size="12" fill="#ffd166">もっと上（${pos.el.toFixed(0)}°）</text>`;
  // 上の説明
  const turn = ((pos.az - p.start.az + 540) % 360) - 180;
  const head = t === 0 ? `まず ${dir16(p.start.az)} を向いて立つ。光は①に現れ、点線の向きへ進む`
    : t >= 1 ? `${dir16(pos.az)} の空で消える。出現から顔を${turn < 0 ? '左' : '右'}へ ${Math.abs(turn).toFixed(0)}° 回したところ`
      : `いま ${dir16(centerAz)} を向いている（出現の向きから${turn < 0 ? '左' : '右'}へ ${Math.abs(turn).toFixed(0)}°）。顔を回しながら光を追う`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="自分の目から見た空の見え方。黄色の線が ISS の道筋、四角は腕を伸ばした拳">
<defs><radialGradient id="fpGlow"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
<linearGradient id="fpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a4a"/><stop offset="1" stop-color="#2a3d6e"/></linearGradient>
<clipPath id="fpClip"><rect x="0" y="0" width="${width}" height="${height}" rx="8"/></clipPath></defs>
<g clip-path="url(#fpClip)">
<rect x="0" y="0" width="${width}" height="${horizonY}" fill="url(#fpSky)"/>
<rect x="0" y="${horizonY}" width="${width}" height="${height - horizonY}" fill="#182233"/>
<g fill="#fff" opacity=".7"><circle cx="${x(centerAz - 30).toFixed(1)}" cy="90" r="1.3"/><circle cx="${x(centerAz - 12).toFixed(1)}" cy="140" r="1"/><circle cx="${x(centerAz + 5).toFixed(1)}" cy="80" r="1.4"/><circle cx="${x(centerAz + 22).toFixed(1)}" cy="120" r="1.1"/><circle cx="${x(centerAz + 38).toFixed(1)}" cy="70" r="1.3"/><circle cx="${x(centerAz - 40).toFixed(1)}" cy="170" r="1"/><circle cx="${x(centerAz + 15).toFixed(1)}" cy="200" r="1.2"/></g>
${sky}
${elLines}
<line x1="0" x2="${width}" y1="${horizonY}" y2="${horizonY}" stroke="currentColor" stroke-width="1.5"/>
${ticks}
${todo}${done}
${hand}${fistLabel}
${marks}
${light}
<text x="16" y="22" font-size="12" fill="currentColor" fill-opacity=".85">あなたの目から見た空（横 90°・上は真上まで）。明るい星のような光が、点滅せず、すべるように動く</text>
<text x="16" y="42" font-size="13" fill="currentColor" font-weight="700">${head}</text>
<text x="16" y="${height - 12}" font-size="11" fill="currentColor" fill-opacity=".6">黄色＝ISS の道筋（実線は通った分、点線はこれから）　四角＝腕を伸ばした拳（1 つ≒高さ10°）　点線の横線＝高さ30°・60°</text>
</g>
</svg>`;
}


// 図5: 後ろ斜め上から見た「あなたと空のドーム」。地平線の輪、方角、頭上へ向かう軌跡、指さす腕
// opts: { t, centerAz }（firstPersonSvg と同じ）
export function domeViewSvg(p, opts = {}, width = 720, height = 480) {
  const D = Math.PI / 180;
  const track = passTrack(p);
  const t = Math.max(0, Math.min(1, opts.t ?? 0));
  const pos = track.at(t);
  // 図は回さない。いちばん高くなる方角を奥にして固定し、光だけが動く（図全体が回ると分かりにくい: 2026-10-27）
  const centerAz = opts.fixedAz ?? p.peak.az;
  // 3D: x=右, y=奥, z=上。空は半径 1 の半球（お椀をかぶせた形）
  const P3 = (az, el, r = 1) => { const a = (az - centerAz) * D, e = el * D; return [r * Math.cos(e) * Math.sin(a), r * Math.cos(e) * Math.cos(a), r * Math.sin(e)]; };
  // カメラ: 観測者の後ろ 2.6、高さ 1.35 から、ドームの中ほどを見る
  const E = [0, -2.6, 1.35], F = [0, 0.05, 0.42];
  const f = (() => { const d = [F[0] - E[0], F[1] - E[1], F[2] - E[2]]; const n = Math.hypot(...d); return d.map((c) => c / n); })();
  const rgt = [1, 0, 0];
  const up = [-(f[1] * rgt[2] - f[2] * rgt[1]), -(f[2] * rgt[0] - f[0] * rgt[2]), -(f[0] * rgt[1] - f[1] * rgt[0])];
  const focal = 1.42;
  const proj = (P) => { const d = [P[0] - E[0], P[1] - E[1], P[2] - E[2]]; const zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (zc < 0.08) return null; const xc = d[0] * rgt[0] + d[1] * rgt[1] + d[2] * rgt[2]; const yc = d[0] * up[0] + d[1] * up[1] + d[2] * up[2]; return [width / 2 + (xc / zc) * focal * width / 2, height * 0.5 - (yc / zc) * focal * width / 2]; };
  const S = (az, el, r) => proj(P3(az, el, r));
  const pt = (q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`;
  const poly = (pts, attrs) => { const seg = []; let cur = []; for (const q of pts) { if (!q) { if (cur.length) seg.push(cur); cur = []; } else cur.push(pt(q)); } if (cur.length) seg.push(cur); return seg.map((s) => `<polyline points="${s.join(' ')}" ${attrs}/>`).join(''); };
  // 手前（カメラ側）か奥か。奥は薄く描いて、ドームの丸みが分かるようにする
  const isFar = (az) => Math.cos((az - centerAz) * D) > 0;
  const ringHalf = (el, far, attrs) => poly(Array.from({ length: 73 }, (_, i) => { const az = centerAz + i * 5 - 180; return isFar(az) === far ? S(az, el) : null; }), attrs);
  const ring = (el, attrs) => poly(Array.from({ length: 73 }, (_, i) => S(centerAz + i * 5 - 180, el)), attrs);
  // 地面: 地平線の輪の内側。中心から外へ少し明るくして「床」に見せる
  const groundPts = Array.from({ length: 73 }, (_, i) => S(centerAz + i * 5 - 180, 0)).filter(Boolean).map(pt).join(' ');
  // ドームの輪郭（空の半球を、地平線から真上まで 8 本の線で）
  let meridians = '';
  for (let k = 0; k < 8; k++) {
    const az = centerAz + k * 45;
    meridians += poly(Array.from({ length: 19 }, (_, i) => S(az, i * 5)), `fill="none" stroke="#9fb4e8" stroke-opacity="${isFar(az) ? .12 : .22}" stroke-width="1"`);
  }
  const horizonFar = ringHalf(0, true, 'fill="none" stroke="#e8ecf5" stroke-opacity=".55" stroke-width="1.4"');
  const horizonNear = ringHalf(0, false, 'fill="none" stroke="#e8ecf5" stroke-width="2.2"');
  const rings = [30, 60].map((el) => ringHalf(el, true, 'fill="none" stroke="#9fb4e8" stroke-opacity=".2" stroke-dasharray="4 5"') + ringHalf(el, false, 'fill="none" stroke="#9fb4e8" stroke-opacity=".45" stroke-dasharray="4 5"')).join('');
  // 方角ラベル（地平線の少し外側）。奥は小さく薄く
  const DIRS8 = [['北', 0], ['北東', 45], ['東', 90], ['南東', 135], ['南', 180], ['南西', 225], ['西', 270], ['北西', 315]];
  let labels = '';
  for (const [n, az] of DIRS8) { const q = S(az, 0, 1.1); if (!q || q[1] > height - 6) continue; const far = isFar(az); labels += `<text x="${q[0].toFixed(1)}" y="${(q[1] + 5).toFixed(1)}" text-anchor="middle" font-size="${far ? 12 : 14}" font-weight="700" fill="currentColor" fill-opacity="${far ? .6 : .95}">${n}</text>`; }
  // 高さの目安（手前側の輪に書く）
  const zen = S(0, 89.9);
  const qpk = S(p.peak.az, p.peak.el);
  const zenLabel = zen && !(qpk && Math.hypot(qpk[0] - zen[0], qpk[1] - zen[1]) < 40) ? `<circle cx="${zen[0].toFixed(1)}" cy="${zen[1].toFixed(1)}" r="2" fill="#9fb4e8"/><text x="${zen[0].toFixed(1)}" y="${(zen[1] - 7).toFixed(1)}" text-anchor="middle" font-size="11" fill="#9fb4e8">真上（90°）</text>` : '';
  // 道筋: 空の上の黄色い線と、その真下を地面にたどった灰色の点線（線が空に浮いていることが分かるように）
  const N = 60;
  const samples = Array.from({ length: N + 1 }, (_, i) => track.at(i / N));
  const skyPts = samples.map((q) => S(q.az, q.el));
  const groundTrail = poly(samples.map((q) => S(q.az, 0, Math.cos(q.el * D))), 'fill="none" stroke="#c9d3ea" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="3 4"');
  const iDone = Math.round(t * N);
  const done = iDone > 0 ? poly(skyPts.slice(0, iDone + 1), 'fill="none" stroke="#ffd166" stroke-width="4" stroke-linecap="round"') : '';
  const todoStr = skyPts.slice(iDone).filter(Boolean).map(pt);
  const todo = iDone < N ? poly(skyPts.slice(iDone), 'fill="none" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="7 7" opacity=".85"') + arrowsAlong(todoStr, Math.max(1, Math.round(3 * (1 - t))), '#ffd166', 8) : '';
  // 高さを示す縦線: 光から真下の地面へ（いま）と、最も高い所から地面へ
  const drop = (az, el, attrs) => { const a = S(az, el), b = S(az, 0, Math.cos(el * D)); return a && b ? `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" ${attrs}/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="2.5" fill="#c9d3ea" fill-opacity=".6"/>` : ''; };
  const dropNow = t > 0 && t < 1 ? drop(pos.az, pos.el, 'stroke="#ffd166" stroke-opacity=".45" stroke-dasharray="2 4"') : '';
  const dropPeak = drop(p.peak.az, p.peak.el, 'stroke="#c9d3ea" stroke-opacity=".3" stroke-dasharray="2 4"');
  // ①②③ の印
  // 文字は、②は上に、①③は外側（左右）に置く。地平線近くの方角の文字と重ならないように
  const mark = (q, n, text, place) => {
    if (!q) return '';
    const side = place === 'above' ? 'middle' : q[0] < width / 2 ? 'end' : 'start';
    const tx = place === 'above' ? q[0] : q[0] + (side === 'end' ? -14 : 14), ty = place === 'above' ? q[1] - 16 : q[1] + 4;
    return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="9" fill="#ffd166"/><text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="#1a1400">${n}</text><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${side}" font-size="12" font-weight="700" fill="#ffd166" stroke="#0b1230" stroke-width="3" paint-order="stroke">${text}</text>`;
  };
  const qs = S(p.start.az, p.start.el), qp = qpk, qe = S(p.end.az, p.end.el);
  // 高さの目安ラベル: 手前の右か左のうち、①②③の文字から遠い側に
  let elLabels = '';
  const farFromMarks = (q) => Math.min(...[qs, qp, qe].filter(Boolean).map((m) => Math.hypot(m[0] - q[0], m[1] - q[1])), 1e9);
  const elSide = [140, 220, 40, 320].map((a) => { const q = S(centerAz + a, 30); return [a, q ? farFromMarks(q) : 0]; }).sort((x, y) => y[1] - x[1])[0][0];
  const elRight = elSide < 180;
  for (const el of [30, 60]) { const q = S(centerAz + elSide, el); if (q) elLabels += `<text x="${(q[0] + (elRight ? 6 : -6)).toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="${elRight ? 'start' : 'end'}" font-size="11" fill="#9fb4e8">高さ${el}°${el === 30 ? '（拳3つ）' : '（拳6つ）'}</text>`; }
  const marks = mark(qs, '①', `現れる ${hhmm(p.start.d)}・${dir16(p.start.az)}`, 'side') + mark(qp, '②', `最も高い ${hhmm(p.peak.d)}・${p.peak.el.toFixed(0)}°`, 'above') + mark(qe, '③', `消える ${hhmm(p.end.d)}・${dir16(p.end.az)}`, 'side');
  // 観測者（中央に立つ。体は光の方へ向き、腕で指す）
  const H = 0.34;
  const faceA = (pos.az - centerAz) * D;                       // 体の向き（光の方角）
  const sh = (s) => proj([Math.cos(faceA) * s, -Math.sin(faceA) * s, H * 0.8]); // 肩の左右
  const head = proj([0, 0, H]), hip = proj([0, 0, H * 0.48]), neck = proj([0, 0, H * 0.82]);
  const footL = proj([Math.cos(faceA) * -0.05, Math.sin(faceA) * 0.05, 0]), footR = proj([Math.cos(faceA) * 0.05, Math.sin(faceA) * -0.05, 0]), foot = proj([0, 0, 0]);
  const shL = sh(-0.07), shR = sh(0.07);
  const arm = (() => { const P = P3(pos.az, pos.el, 1); const L = H * 0.8; const base = [Math.cos(faceA) * 0.07, -Math.sin(faceA) * 0.07, H * 0.8]; const v = [P[0] - base[0], P[1] - base[1], P[2] - base[2]]; const n = Math.hypot(...v); return [proj(base), proj([base[0] + v[0] / n * L, base[1] + v[1] / n * L, base[2] + v[2] / n * L])]; })();
  const lineTo = (a, b, w, c = '#e8ecf5') => (a && b ? `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>` : '');
  const shadow = foot ? `<ellipse cx="${foot[0].toFixed(1)}" cy="${(foot[1] + 2).toFixed(1)}" rx="18" ry="5" fill="#000" fill-opacity=".35"/>` : '';
  const person = shadow + lineTo(hip, footL, 6) + lineTo(hip, footR, 6) + lineTo(neck, hip, 11) + lineTo(shL, shR, 7) + lineTo(arm[0], arm[1], 5, '#ffd166')
    + (head ? `<circle cx="${head[0].toFixed(1)}" cy="${head[1].toFixed(1)}" r="11" fill="#e8ecf5"/>` : '')
    + (foot ? `<text x="${(foot[0] + 22).toFixed(1)}" y="${(foot[1] + 4).toFixed(1)}" font-size="13" font-weight="700" fill="currentColor">あなた</text>` : '');
  // 目から光への視線
  const L = S(pos.az, pos.el);
  const sight = head && L ? `<line x1="${head[0].toFixed(1)}" y1="${head[1].toFixed(1)}" x2="${L[0].toFixed(1)}" y2="${L[1].toFixed(1)}" stroke="#fff" stroke-opacity=".25" stroke-dasharray="2 5"/>` : '';
  // 光（いまの位置）
  const nowLabel = t > 0 && t < 1 ? `${hhmmss(pos.d)}　${dir16(pos.az)}・高さ${pos.el.toFixed(0)}°` : '';
  // いまの位置の文字: 上・下・右・左のうち、①②③の文字から最も遠い所に置く
  // ①②③の文字のおおよその矩形 [x0, y0, x1, y1]（①③は外側に 150 px、②は上に 140 px）
  const sideRect = (q) => (q ? (q[0] < width / 2 ? [q[0] - 164, q[1] - 9, q[0] - 14, q[1] + 9] : [q[0] + 14, q[1] - 9, q[0] + 164, q[1] + 9]) : null);
  const markRects = [sideRect(qs), qp && [qp[0] - 70, qp[1] - 29, qp[0] + 70, qp[1] - 11], sideRect(qe)].filter(Boolean);
  const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const nowPos = (() => {
    if (!L) return null;
    const W = 180, Hh = 18;
    const cands = [[L[0], L[1] - 34, 'middle'], [L[0], L[1] + 46, 'middle'], [L[0] + 34, L[1] + 5, 'start'], [L[0] - 34, L[1] + 5, 'end']];
    const rect = (c) => (c[2] === 'middle' ? [c[0] - W / 2, c[1] - Hh, c[0] + W / 2, c[1]] : c[2] === 'start' ? [c[0], c[1] - Hh, c[0] + W, c[1]] : [c[0] - W, c[1] - Hh, c[0], c[1]]);
    const score = (c) => { const r = rect(c); let bad = markRects.reduce((sum, m) => sum + overlap(r, m), 0); if (r[0] < 4 || r[2] > width - 4 || r[1] < 30) bad += 1e4; return bad; };
    return cands.map((c, i) => [c, score(c) + i]).sort((a, b) => a[1] - b[1])[0][0]; // 同点なら上→下→右→左の順
  })();
  const light = L ? `<circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="26" fill="url(#dmGlow)"/><circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="5.5" fill="#fff"/>${nowLabel ? `<text x="${nowPos[0].toFixed(1)}" y="${nowPos[1].toFixed(1)}" text-anchor="${nowPos[2]}" font-size="13" font-weight="700" fill="#fff" stroke="#0b1230" stroke-width="3" paint-order="stroke">${nowLabel}</text>` : ''}` : '';
  // 星
  let stars = '';
  for (let i = 0; i < 30; i++) { const q = S((i * 47) % 360, 8 + (i * 29) % 70); if (q) stars += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${1 + (i % 3) * 0.4}" fill="#fff" opacity=".5"/>`; }
  // 上の説明。顔の向きは、いまの光の方角から
  const face = dir16(pos.az);
  const turn = ((pos.az - p.start.az + 540) % 360) - 180;
  const headTxt = t === 0 ? `空をお椀のような丸天井に見立て、あなたの後ろ上から見た図。まず ${dir16(p.start.az)} を向いて待つ`
    : t >= 1 ? `${face} の空で消える。出現から顔を${turn < 0 ? '左' : '右'}へ ${Math.abs(turn).toFixed(0)}° 回したところ`
      : `いま ${face} を向いている（出現の向きから${turn < 0 ? '左' : '右'}へ ${Math.abs(turn).toFixed(0)}°）。顔を回しながら光を追う`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="空のドームを後ろ上から見た図。黄色の線が ISS の道筋、灰色の点線はその真下">
<defs><radialGradient id="dmGlow"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
<linearGradient id="dmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070f2a"/><stop offset="1" stop-color="#1c2c58"/></linearGradient>
<radialGradient id="dmGround" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#2a3a3a"/><stop offset="1" stop-color="#172230"/></radialGradient></defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="url(#dmSky)" rx="8"/>
${stars}
<polygon points="${groundPts}" fill="url(#dmGround)" fill-opacity=".97"/>
${meridians}${rings}${horizonFar}${groundTrail}${dropPeak}
${todo}${done}
${horizonNear}${labels}${elLabels}${zenLabel}
${dropNow}${sight}
${person}
${marks}
${light}
<text x="16" y="22" font-size="12.5" fill="currentColor" fill-opacity=".9">${headTxt}</text>
<text x="16" y="${height - 12}" font-size="11" fill="currentColor" fill-opacity=".6">白い輪＝地平線　点線の輪＝高さ30°・60°　黄色＝ISS の道筋　灰色の点線＝道筋の真下の地面</text>
</svg>`;
}
