// ISS パス抽出 + 可視判定（条件1〜3: 最大仰角 / 光度 / 太陽高度）
import * as satellite from 'satellite.js';
import { sunEci, isSunlit, phaseAngle, magnitude, observerEci, sunAltitudeDeg } from './astro.mjs?v=dbc5603-1736';

const DEG = Math.PI / 180;

export const DEFAULT_CRITERIA = {
  minMaxElevationDeg: 30,   // 可視区間内の最大仰角 >= 30°
  maxMagnitude: -1.0,       // 可視区間内の最良光度 <= -1 等
  maxSunAltitudeDeg: -8,    // 観測地の太陽高度 <= -8°
  minElevationDeg: 10,      // 「可視区間」とみなす仰角下限（地物・大気減光の実用値）
};

export function parseTle(text) {
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const l1 = lines.find((l) => l.startsWith('1 '));
  const l2 = lines.find((l) => l.startsWith('2 '));
  if (!l1 || !l2) throw new Error('TLE parse failed');
  return { name: lines[0].startsWith('1 ') ? 'ISS' : lines[0], line1: l1, line2: l2 };
}

/**
 * 期間内のパスを列挙する。
 * 各パスについて、仰角>0 の全区間と、可視区間（仰角>=min, 日照, 太陽高度<=閾値）を返す。
 */
export function* iteratePasses(satrec, obsGd, startDate, endDate, criteria = DEFAULT_CRITERIA, coarseStepSec = 30, fineStepSec = 5) {
  let t = startDate.getTime();
  const end = endDate.getTime();
  let inPass = false;
  let passStart = null;

  const sample = (ms) => {
    const d = new Date(ms);
    const pv = satellite.propagate(satrec, d);
    if (!pv.position || typeof pv.position === 'boolean') return null;
    const gmst = satellite.gstime(d);
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const la = satellite.ecfToLookAngles(obsGd, ecf);
    return { d, ms, eci: pv.position, gmst, el: la.elevation / DEG, az: ((la.azimuth / DEG) + 360) % 360, range: la.rangeSat };
  };

  const analyzePass = (startMs, endMs) => {
    const pts = [];
    for (let ms = startMs; ms <= endMs; ms += fineStepSec * 1000) {
      const s = sample(ms);
      if (!s || s.el <= 0) continue;
      const sun = sunEci(s.d);
      const lit = isSunlit(s.eci, sun);
      const sunAlt = sunAltitudeDeg(obsGd, sun, s.gmst);
      const obsEci = observerEci(obsGd, s.gmst);
      const ph = phaseAngle(s.eci, obsEci, sun);
      const mag = lit ? magnitude(s.range, ph) : Infinity;
      pts.push({ ...s, lit, sunAlt, mag });
    }
    if (pts.length === 0) return null;
    const peak = pts.reduce((a, b) => (b.el > a.el ? b : a));
    const vis = pts.filter((p) => p.lit && p.el >= criteria.minElevationDeg && p.sunAlt <= criteria.maxSunAltitudeDeg);
    let visible = null;
    if (vis.length) {
      const vpeak = vis.reduce((a, b) => (b.el > a.el ? b : a));
      const brightest = vis.reduce((a, b) => (b.mag < a.mag ? b : a));
      visible = {
        start: vis[0], end: vis[vis.length - 1], peak: vpeak, brightest,
        maxElevation: vpeak.el, bestMagnitude: brightest.mag,
        sunAltAtPeak: vpeak.sunAlt,
      };
    }
    const qualifies = !!visible
      && visible.maxElevation >= criteria.minMaxElevationDeg
      && visible.bestMagnitude <= criteria.maxMagnitude;
    return { aos: pts[0], los: pts[pts.length - 1], peak, visible, qualifies };
  };

  while (t <= end) {
    const s = sample(t);
    if (!s) { t += coarseStepSec * 1000; continue; }
    if (!inPass && s.el > 0) {
      inPass = true;
      passStart = t - coarseStepSec * 1000;
    } else if (inPass && s.el <= 0) {
      inPass = false;
      const p = analyzePass(passStart, t);
      if (p) yield p;
    }
    t += coarseStepSec * 1000;
  }
}

/**
 * 地上軌跡: 期間内の ISS の真下の地点（緯度・経度・高度 km）を stepSec ごとに
 */
export function groundTrack(satrec, from, to, stepSec = 15) {
  const out = [];
  for (let ms = from.getTime(); ms <= to.getTime(); ms += stepSec * 1000) {
    const d = new Date(ms);
    const pv = satellite.propagate(satrec, d);
    if (!pv.position || typeof pv.position === 'boolean') continue;
    const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(d));
    out.push({ d, lat: gd.latitude / DEG, lon: ((gd.longitude / DEG + 540) % 360) - 180, alt: gd.height });
  }
  return out;
}

export function makeSatrec(tle, { zeroDrag = false } = {}) {
  const rec = satellite.twoline2satrec(tle.line1, tle.line2);
  if (zeroDrag) { rec.bstar = 0; }
  return rec;
}

export function observer(latDeg, lonDeg, altKm = 0.03) {
  return { latitude: latDeg * DEG, longitude: lonDeg * DEG, height: altKm };
}
