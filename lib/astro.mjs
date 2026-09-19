// 太陽位置・地球影・光度の自前実装（satellite.js の TEME/ECF 座標系と組み合わせて使う）
import * as satellite from 'satellite.js';

const DEG = Math.PI / 180;
export const R_EARTH_KM = 6378.137;
const AU_KM = 149597870.7;

// ユリウス日
export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// 太陽の ECI(TEME近似) 位置 [km]。Meeus の低精度アルゴリズム（誤差 ~0.01°）
export function sunEci(date) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  const M = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360) * DEG;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
          + 0.000289 * Math.sin(3 * M);
  const trueLon = (L0 + C) * DEG;
  const nu = M + C * DEG;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(nu)); // AU
  const eps = (23.439291 - 0.0130042 * T) * DEG;
  const r = R * AU_KM;
  return {
    x: r * Math.cos(trueLon),
    y: r * Math.sin(trueLon) * Math.cos(eps),
    z: r * Math.sin(trueLon) * Math.sin(eps),
  };
}

const norm = (v) => Math.hypot(v.x, v.y, v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

// 地球影判定。円錐本影（umbra）で判定し、半影は「明るい」扱い
export function isSunlit(satEci, sunEciPos) {
  const rs = norm(sunEciPos);
  const rsat = norm(satEci);
  // 太陽方向単位ベクトル
  const s = { x: sunEciPos.x / rs, y: sunEciPos.y / rs, z: sunEciPos.z / rs };
  const along = dot(satEci, s); // 太陽方向成分
  if (along > 0) return true; // 太陽側にいる
  const perp = Math.sqrt(Math.max(rsat * rsat - along * along, 0));
  // 本影円錐の半径（距離 |along| で）
  const R_SUN_KM = 695700;
  const umbraHalfAngle = Math.asin((R_SUN_KM - R_EARTH_KM) / rs);
  const umbraRadius = R_EARTH_KM - Math.abs(along) * Math.tan(umbraHalfAngle);
  return perp > umbraRadius;
}

// 位相角 [rad]（衛星から見た 太陽–観測者 の角）
export function phaseAngle(satEci, obsEci, sunEciPos) {
  const toSun = sub(sunEciPos, satEci);
  const toObs = sub(obsEci, satEci);
  const c = dot(toSun, toObs) / (norm(toSun) * norm(toObs));
  return Math.acos(Math.min(1, Math.max(-1, c)));
}

// 光度概算。拡散球の位相関数 + 距離則。
// M0 = 満相・1000km での等級。ISS は「50%照明・1000km で -1.8 等」が通例なので M0 ≈ -3.0
export function magnitude(rangeKm, phaseRad, M0 = -3.0) {
  const F = ((Math.PI - phaseRad) * Math.cos(phaseRad) + Math.sin(phaseRad)) / Math.PI;
  if (F <= 0) return Infinity;
  return M0 + 5 * Math.log10(rangeKm / 1000) - 2.5 * Math.log10(F);
}

// 観測者の ECI 位置 [km]
export function observerEci(obsGd, gmst) {
  const ecf = satellite.geodeticToEcf(obsGd);
  return satellite.ecfToEci(ecf, gmst);
}

// 観測地から見た太陽高度 [deg]
export function sunAltitudeDeg(obsGd, sunEciPos, gmst) {
  const sunEcf = satellite.eciToEcf(sunEciPos, gmst);
  const la = satellite.ecfToLookAngles(obsGd, sunEcf);
  return la.elevation / DEG;
}
