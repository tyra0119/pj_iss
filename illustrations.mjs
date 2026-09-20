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
  const path = `M${x(p.start.az).toFixed(1)},${y(p.start.el).toFixed(1)} Q${x(p.peak.az).toFixed(1)},${(y(p.peak.el) - 20).toFixed(1)} ${x(p.peak.az).toFixed(1)},${y(p.peak.el).toFixed(1)} T${x(p.end.az).toFixed(1)},${y(p.end.el).toFixed(1)}`;
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
<path d="${path}" fill="none" stroke="${ACC}" stroke-width="3" stroke-dasharray="8 6"/>
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
// 横 90°・縦 0〜60° の視野。ISS は出現位置に光り、最高点の方向へ点線で進む
export function firstPersonSvg(p, width = 720, height = 420) {
  const DIRS = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  const dir16 = (az) => DIRS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
  const hhmm = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(11, 16);
  const centerAz = p.start.az;
  const halfFov = 45, maxEl = 60;
  const horizonY = height - 96;
  const x = (az) => { let d = ((az - centerAz + 540) % 360) - 180; d = Math.max(-halfFov, Math.min(halfFov, d)); return width / 2 + (d / halfFov) * (width / 2 - 24); };
  const y = (el) => horizonY - (Math.min(el, maxEl) / maxEl) * (horizonY - 28);
  // 方位の目盛り（15°ごと）
  let ticks = '';
  for (let d = -45; d <= 45; d += 15) {
    const az = (centerAz + d + 360) % 360;
    ticks += `<line x1="${x(az).toFixed(1)}" y1="${horizonY}" x2="${x(az).toFixed(1)}" y2="${horizonY + 8}" stroke="currentColor" stroke-opacity=".8"/><text x="${x(az).toFixed(1)}" y="${horizonY + 24}" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity="${d === 0 ? 1 : .7}" font-weight="${d === 0 ? 700 : 400}">${dir16(az)}</text>`;
  }
  // 地面と、遠くのシルエット（木・建物）
  let sky = '';
  let sx = 0, seed = 11;
  while (sx < width) { seed = (seed * 9301 + 49297) % 233280; const w = 18 + (seed % 40), h = 8 + (seed % 26); const tree = seed % 3 === 0; sky += tree ? `<ellipse cx="${sx + w / 2}" cy="${horizonY - h / 2}" rx="${w / 2}" ry="${h / 2 + 4}" fill="#0b1020"/>` : `<rect x="${sx}" y="${horizonY - h}" width="${w}" height="${h}" fill="#0b1020"/>`; sx += w + 6; }
  // 拳の積み重ね（10°ごと）: 手前中央に腕、出現の高さまで拳を積む
  const fists = Math.max(1, Math.round(p.start.el / 10));
  const fistW = 44, fistH = (y(0) - y(10));
  const armX = width / 2;
  let hand = `<path d="M${armX - 26},${height} L${armX - 18},${horizonY + 10} L${armX + 18},${horizonY + 10} L${armX + 26},${height} Z" fill="#1a2440" stroke="#3c5a8a" stroke-width="1.5"/>`;
  for (let i = 0; i < fists; i++) {
    const top = y((i + 1) * 10), bottom = y(i * 10);
    hand += `<rect x="${armX - fistW / 2}" y="${top + 2}" width="${fistW}" height="${Math.max(6, bottom - top - 4)}" rx="9" fill="#243055" stroke="#5f7bb0" stroke-width="1.5" fill-opacity=".92"/>`
      + `<line x1="${armX - fistW / 2 + 8}" y1="${(top + 10).toFixed(1)}" x2="${armX + fistW / 2 - 8}" y2="${(top + 10).toFixed(1)}" stroke="#5f7bb0" stroke-opacity=".7"/>`
      + `<text x="${armX + fistW / 2 + 8}" y="${((top + bottom) / 2 + 4).toFixed(1)}" font-size="12" fill="currentColor" fill-opacity=".85">拳${i + 1}つ＝${(i + 1) * 10}°</text>`;
  }
  void fistH;
  // ISS の出現点と、進む先（最高点の方向）
  const sxp = x(p.start.az), syp = y(p.start.el);
  const peakIn = Math.abs(((p.peak.az - centerAz + 540) % 360) - 180) <= halfFov && p.peak.el <= maxEl;
  const tx = peakIn ? x(p.peak.az) : (((p.peak.az - centerAz + 540) % 360) - 180 > 0 ? width - 30 : 30);
  const ty = peakIn ? y(p.peak.el) : 78;
  const path = `M${sxp.toFixed(1)},${syp.toFixed(1)} Q${((sxp + tx) / 2).toFixed(1)},${(Math.min(syp, ty) - 30).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;
  const peakLabel = peakIn ? `最高 ${hhmm(p.peak.d)}・${p.peak.el.toFixed(0)}°` : `${dir16(p.peak.az)}の${p.peak.el >= 60 ? 'ほぼ頭上' : '高い空'}へ上がっていく（${p.peak.el.toFixed(0)}°）`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="自分の目から見た空の見え方">
<defs><radialGradient id="fpGlow"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
<linearGradient id="fpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a4a"/><stop offset="1" stop-color="#2a3d6e"/></linearGradient></defs>
<rect x="0" y="0" width="${width}" height="${horizonY}" fill="url(#fpSky)" rx="8"/>
<rect x="0" y="${horizonY}" width="${width}" height="${height - horizonY}" fill="#182233" rx="8"/>
<g fill="#fff" opacity=".7"><circle cx="80" cy="60" r="1.3"/><circle cx="200" cy="110" r="1"/><circle cx="330" cy="50" r="1.4"/><circle cx="500" cy="90" r="1.1"/><circle cx="640" cy="40" r="1.3"/><circle cx="420" cy="150" r="1"/><circle cx="120" cy="170" r="1.1"/><circle cx="600" cy="140" r="1"/></g>
${sky}
<line x1="0" x2="${width}" y1="${horizonY}" y2="${horizonY}" stroke="currentColor" stroke-width="1.5"/>
${ticks}
<text x="16" y="42" font-size="13" fill="currentColor" font-weight="700">正面を ${dir16(p.start.az)} に向けて立ち、腕をまっすぐ伸ばして拳を積む</text>
<path d="${path}" fill="none" stroke="#ffd166" stroke-width="3" stroke-dasharray="7 7" opacity=".9"/>
<text x="${(peakIn ? tx : (tx > width / 2 ? tx - 12 : tx + 12)).toFixed(1)}" y="${(peakIn ? ty - 12 : ty + 22).toFixed(1)}" text-anchor="${peakIn ? 'middle' : (tx > width / 2 ? 'end' : 'start')}" font-size="12" fill="#ffd166">${peakLabel}</text>
${hand}
<circle cx="${sxp.toFixed(1)}" cy="${syp.toFixed(1)}" r="26" fill="url(#fpGlow)"/>
<circle cx="${sxp.toFixed(1)}" cy="${syp.toFixed(1)}" r="5" fill="#fff"/>
<text x="${sxp.toFixed(1)}" y="${(syp - 34).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="#ffd166">ここに現れる ${hhmm(p.start.d)}</text>
<text x="${sxp.toFixed(1)}" y="${(syp - 18).toFixed(1)}" text-anchor="middle" font-size="12" fill="currentColor">${dir16(p.start.az)}・拳${fists}つ分（${p.start.el.toFixed(0)}°）</text>
<text x="16" y="22" font-size="12" fill="currentColor" fill-opacity=".85">あなたの目から見た空（横 90°）。明るい星のような光が、点滅せず、すべるように動く</text>
</svg>`;
}
