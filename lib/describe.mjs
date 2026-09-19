// 層1: パスの見方を日常語で説明する（センサー不要）

export const DIRS16 = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
export const dir16 = (az) => DIRS16[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];

// 仰角の日常語
export function heightWords(el) {
  if (el < 15) return '低い空';
  if (el < 30) return 'やや低い空';
  if (el < 50) return '空の真ん中あたり';
  if (el < 70) return '高い空';
  return 'ほぼ頭の真上';
}

// 拳の目安（腕を伸ばした拳1つ ≒ 10°）
export function fistWords(el) {
  if (el >= 80) return '真上を見上げる';
  const n = Math.max(1, Math.round(el / 10));
  return `地平線から拳${n}つ分`;
}

const hhmm = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(11, 16);

/**
 * @param {{start:{d:Date,az:number,el:number}, peak:{d:Date,az:number,el:number}, end:{d:Date,az:number,el:number}, mag:number}} p
 */
export function describePass(p) {
  const s = p.start, k = p.peak, e = p.end;
  const lines = [];
  lines.push(`${hhmm(s.d)}ごろ、${dir16(s.az)}の${heightWords(s.el)}（${fistWords(s.el)}、${s.el.toFixed(0)}°）に明るい星のような光が現れます。`);
  lines.push(`${hhmm(k.d)}に${dir16(k.az)}の${heightWords(k.el)}（${fistWords(k.el)}、${k.el.toFixed(0)}°）を通ります。ここが一番明るく、約${p.mag.toFixed(1)}等です。`);
  const lastsSec = Math.round((e.d - s.d) / 1000);
  const endWhy = e.el > 15 ? '地球の影に入って急に消えます' : '低い空に沈んでいきます';
  lines.push(`${hhmm(e.d)}に${dir16(e.az)}の${heightWords(e.el)}（${e.el.toFixed(0)}°）で${endWhy}。見えているのは約${Math.round(lastsSec / 60)}分${lastsSec % 60 ? `${lastsSec % 60}秒` : ''}です。`);
  return lines;
}

export const HOW_TO_FIND = [
  '点滅せず、音もなく、飛行機よりずっと速く動く白い光です。一番明るい星より明るく見えます。',
  '日没直後なら、太陽が沈んだ方向がおおよそ西です。地図アプリで現在地を出し、駅や橋の方向と合わせて方角を確かめてください。',
  '腕をまっすぐ伸ばして握った拳1つ分が約10°、親指から小指まで開いた手が約20°です。',
  '出現の2〜3分前から、出現方位のやや上を広く眺めて待ちます。最初は暗く、上がるにつれて明るくなります。',
];

// 方位を横軸、仰角を縦軸にした「空の帯」の SVG（出現方位を中心に ±120°）
export function skyStripSvg(p, width = 640, height = 200) {
  const centerAz = p.peak.az;
  const half = 120;
  const x = (az) => {
    let d = ((az - centerAz + 540) % 360) - 180;
    d = Math.max(-half, Math.min(half, d));
    return width / 2 + (d / half) * (width / 2 - 20);
  };
  const y = (el) => height - 24 - (el / 90) * (height - 44);
  const pts = [p.start, ...(p.track ?? []), p.peak, p.end];
  const path = pts.map((q, i) => `${i ? 'L' : 'M'}${x(q.az).toFixed(1)},${y(q.el).toFixed(1)}`).join(' ');
  const ticks = [];
  for (let d = -half; d <= half; d += 30) {
    const az = (centerAz + d + 360) % 360;
    ticks.push(`<text x="${x(az).toFixed(1)}" y="${height - 6}" text-anchor="middle" font-size="11" fill="currentColor">${dir16(az)}</text>`);
  }
  const hlines = [30, 60].map((el) => `<line x1="20" x2="${width - 20}" y1="${y(el)}" y2="${y(el)}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="3 4"/><text x="22" y="${y(el) - 3}" font-size="10" fill="currentColor" fill-opacity=".7">${el}°</text>`).join('');
  const dot = (q, label) => `<circle cx="${x(q.az).toFixed(1)}" cy="${y(q.el).toFixed(1)}" r="4" fill="#ffd166"/><text x="${x(q.az).toFixed(1)}" y="${(y(q.el) - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="currentColor">${label}</text>`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="出現から消失までの空の軌跡">
<line x1="20" x2="${width - 20}" y1="${y(0)}" y2="${y(0)}" stroke="currentColor" stroke-opacity=".6"/>
${hlines}
<path d="${path}" fill="none" stroke="#ffd166" stroke-width="2.5"/>
${dot(p.start, `出現 ${hhmm(p.start.d)}`)}${dot(p.peak, `最高 ${p.peak.el.toFixed(0)}°`)}${dot(p.end, `消失 ${hhmm(p.end.d)}`)}
${ticks.join('')}
</svg>`;
}
