// 行程の逆算: 観測ピーク時刻から「到着締切」「出発の目安」を求める
// 所要時間は ODPT の時刻表で確定するまでの暫定として、距離ベースの目安を使う

export const PLAN_MARGINS = {
  arriveBeforeMin: 15,   // 可視開始の何分前に着くか（方角合わせ・目慣らし）
  leaveAfterMin: 10,     // 可視終了の何分後に現地を出るか
  stationAccessMin: 8,   // 出発地から駅・改札・ホームまで
  waitMin: 6,            // 待ち時間
  transferMin: 8,        // 乗換1回あたり
  railKmh: 30,           // 都市部の鉄道の実効速度（停車・待ち込み）
};

export function haversineKm(a, b) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (b.lat - a.lat) * d, dLon = (b.lon - a.lon) * d;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 出発地 → 観測地 の所要時間の目安 [分]
 * @returns {{ totalMin:number, railMin:number, transfers:number, walkMin:number, km:number }}
 */
export function estimateTravel(from, site, m = PLAN_MARGINS) {
  const km = haversineKm(from, site);
  const routeKm = km * 1.3; // 直線距離→路線距離の目安
  const railMin = Math.round((routeKm / m.railKmh) * 60);
  const transfers = km < 6 ? 0 : km < 25 ? 1 : 2;
  const totalMin = m.stationAccessMin + m.waitMin + railMin + transfers * m.transferMin + site.walkMin;
  return { totalMin, railMin, transfers, walkMin: site.walkMin, km };
}

/**
 * 行程の時刻を組む
 * @param {{start:{d:Date}, end:{d:Date}}} pass 可視区間
 * @param {number} travelMin 所要時間の目安
 */
export function buildItinerary(pass, travelMin, m = PLAN_MARGINS) {
  const arriveBy = new Date(pass.start.d.getTime() - m.arriveBeforeMin * 60e3);
  const departBy = new Date(arriveBy.getTime() - travelMin * 60e3);
  const leaveSite = new Date(pass.end.d.getTime() + m.leaveAfterMin * 60e3);
  const returnBy = new Date(leaveSite.getTime() + travelMin * 60e3); // 帰りも同じ所要で見積もる
  return { departBy, arriveBy, observeFrom: pass.start.d, observeTo: pass.end.d, leaveSite, returnBy, travelMin, totalMin: Math.round((returnBy - departBy) / 60e3) };
}
