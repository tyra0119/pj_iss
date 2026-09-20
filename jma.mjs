// 気象庁の警報・注意報（bosai の JSON）。都県ごとの代表地域（東京地方・神奈川東部・千葉北西部・埼玉南部）で見る
// 外出を止めるべき警報が出ていれば、その日はどの候補地も勧めない
const PREF = { '東京': { office: '130000', area: '130010' }, '神奈川': { office: '140000', area: '140010' }, '千葉': { office: '120000', area: '120010' }, '埼玉': { office: '110000', area: '110010' } };
const NAMES = { '02': '暴風雪警報', '03': '大雨警報', '04': '洪水警報', '05': '暴風警報', '06': '大雪警報', '07': '波浪警報', '08': '高潮警報', '10': '大雨注意報', '12': '大雪注意報', '13': '風雪注意報', '14': '雷注意報', '15': '強風注意報', '16': '波浪注意報', '18': '洪水注意報', '20': '濃霧注意報', '23': '低温注意報', '32': '暴風雪特別警報', '33': '大雨特別警報', '35': '暴風特別警報', '36': '大雪特別警報', '37': '波浪特別警報', '38': '高潮特別警報' };
const STOP = new Set(['02', '03', '04', '05', '06', '32', '33', '35', '36']);   // 外出を勧めない
const CAUTION = new Set(['10', '12', '13', '14', '15', '20']);                    // 注意して
const cache = new Map();

/** @returns {Promise<{pref:string, areaName:string, stop:string[], caution:string[], at:string}|null>} */
export async function fetchWarnings(pref) {
  const p = PREF[pref];
  if (!p) return null;
  if (cache.has(pref) && Date.now() - cache.get(pref).t < 10 * 60e3) return cache.get(pref).v;
  try {
    const res = await fetch(`https://www.jma.go.jp/bosai/warning/data/warning/${p.office}.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    const area = (j.areaTypes?.[0]?.areas ?? []).find((a) => a.code === p.area) ?? j.areaTypes?.[0]?.areas?.[0];
    const codes = (area?.warnings ?? []).filter((w) => w.code && w.status !== '解除').map((w) => w.code);
    const v = { pref, areaName: area?.code ?? p.area, stop: codes.filter((c) => STOP.has(c)).map((c) => NAMES[c] ?? c), caution: codes.filter((c) => CAUTION.has(c)).map((c) => NAMES[c] ?? c), at: j.reportDatetime };
    cache.set(pref, { t: Date.now(), v });
    return v;
  } catch { return null; }
}
