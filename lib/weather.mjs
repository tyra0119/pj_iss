// Open-Meteo から候補地の時間別予報を取り、観測時刻・移動時間帯で判定する
// ブラウザ／Node どちらでも動く（fetch のみ使用）

export const WEATHER_THRESHOLDS = {
  maxCloudLowMidPct: 20,      // 観測: 低層+中層雲量 <= 20%
  cycleMaxPrecipProbPct: 30,  // 移動: 降水確率 >= 30% でシェアサイクル不可
  cycleMaxWindMs: 8,          // 移動: 風速 >= 8 m/s でシェアサイクル不可
  coldWarnC: 3,               // 気温 <= 3℃ で警告
  obsMaxPrecipProbPct: 40,    // 観測: 観測時刻の前後 1 時間の降水確率 >= 40% なら「雨の心配」（晴れ扱いにしない）
};

const HOURLY = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'precipitation_probability', 'precipitation', 'wind_speed_10m', 'temperature_2m'];
export const FORECAST_DAYS = 16;

/**
 * 複数地点の時間別予報をまとめて取得する。
 * @param {{lat:number, lon:number}[]} points
 * @returns {Promise<Array<{time:string[], [k:string]:number[]}>>} points と同じ順
 */
export async function fetchHourly(points, { forecastDays = FORECAST_DAYS } = {}) {
  if (points.length === 0) return [];
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', points.map((p) => p.lat.toFixed(4)).join(','));
  url.searchParams.set('longitude', points.map((p) => p.lon.toFixed(4)).join(','));
  url.searchParams.set('hourly', HOURLY.join(','));
  url.searchParams.set('timezone', 'Asia/Tokyo');
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('forecast_days', String(forecastDays));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  return list.map((j) => j.hourly);
}

// Date → Open-Meteo の時刻文字列（JST, 時単位に切り捨て） "2026-09-26T19:00"
export function hourKeyJst(date) {
  const j = new Date(date.getTime() + 9 * 3600e3);
  return j.toISOString().slice(0, 13) + ':00';
}

function at(hourly, key) {
  const i = hourly.time.indexOf(key);
  if (i < 0) return null;
  const pick = (k) => (hourly[k] ? hourly[k][i] : null);
  return {
    cloudLow: pick('cloud_cover_low'), cloudMid: pick('cloud_cover_mid'), cloudHigh: pick('cloud_cover_high'),
    precipProb: pick('precipitation_probability'), precip: pick('precipitation'),
    wind: pick('wind_speed_10m'), temp: pick('temperature_2m'),
  };
}

/**
 * 1地点について、観測時刻と移動時間帯（往路: 観測-2h〜観測, 復路: 観測〜観測+2h）を評価する。
 * 予報範囲外なら { available:false }
 */
export function assessSite(hourly, peakDate, th = WEATHER_THRESHOLDS) {
  const obs = at(hourly, hourKeyJst(peakDate));
  if (!obs || obs.cloudLow == null) return { available: false };
  const cloudLowMid = Math.min(100, (obs.cloudLow ?? 0) + (obs.cloudMid ?? 0));
  const window = (fromH, toH) => {
    const vals = [];
    for (let h = fromH; h <= toH; h++) {
      const v = at(hourly, hourKeyJst(new Date(peakDate.getTime() + h * 3600e3)));
      if (v) vals.push(v);
    }
    if (!vals.length) return null;
    return {
      precipProb: Math.max(...vals.map((v) => v.precipProb ?? 0)),
      precip: Math.max(...vals.map((v) => v.precip ?? 0)),
      wind: Math.max(...vals.map((v) => v.wind ?? 0)),
      temp: Math.min(...vals.map((v) => v.temp ?? 99)),
    };
  };
  const out = window(-2, 0);
  const back = window(0, 2);
  const legMode = (w) => {
    if (!w) return { cycle: null, walkMaxMin: 15, warn: [] };
    const warn = [];
    let cycle = true;
    if (w.precip > 0) { cycle = false; warn.push('降水あり'); }
    else if (w.precipProb >= th.cycleMaxPrecipProbPct) { cycle = false; warn.push(`降水確率${w.precipProb}%`); }
    if (w.wind >= th.cycleMaxWindMs) { cycle = false; warn.push(`風速${w.wind.toFixed(0)}m/s`); }
    if (w.temp <= th.coldWarnC) warn.push(`気温${w.temp.toFixed(0)}℃`);
    const rainy = w.precip > 0 || w.precipProb >= th.cycleMaxPrecipProbPct;
    return { cycle, walkMaxMin: rainy ? 10 : 15, warn };
  };
  return {
    available: true,
    obs: { ...obs, cloudLowMid },
    // 観測時刻の前後 1 時間で雨の可能性（雲が少なくても、にわか雨・通り雨の予報なら晴れ扱いにしない）
    rainRisk: (() => { const w = window(-1, 1); return !!w && (w.precip > 0 || w.precipProb >= th.obsMaxPrecipProbPct); })(),
    observable: cloudLowMid <= th.maxCloudLowMidPct && !(() => { const w = window(-1, 1); return !!w && (w.precip > 0 || w.precipProb >= th.obsMaxPrecipProbPct); })(),
    unstable: cloudLowMid <= th.maxCloudLowMidPct && (() => { const w = window(-1, 1); return !!w && (w.precip > 0 || w.precipProb >= th.obsMaxPrecipProbPct); })(),
    obsPrecipProb: (() => { const w = window(-1, 1); return w ? w.precipProb : null; })(),
    outbound: { ...out, ...legMode(out) },
    inbound: { ...back, ...legMode(back) },
  };
}
