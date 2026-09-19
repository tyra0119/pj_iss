// 持ち物リスト。天気（気温・降水・風）と計画の種類（夕方 / 夜通し）から組み立てる

/**
 * @param {object} o
 * @param {number|null} o.tempC 観測時刻ごろの気温
 * @param {number} o.precipProb 行き帰りの最大降水確率 [%]
 * @param {number} o.precip 行き帰りの最大降水量 [mm]
 * @param {number} o.wind 最大風速 [m/s]
 * @param {boolean} o.overnight 夜通し（始発で帰る）計画か
 * @param {string} o.siteType 河川敷 / 海浜公園 / 公園 / 海岸
 * @param {Date} o.date
 */
export function packingList(o) {
  const must = [];
  const nice = [];
  must.push('交通系ICカードかスマホ決済（帰りの分の残高も）');
  must.push('スマホと充電済みのモバイルバッテリー（現地モード・地図・カメラで電池を使う）');
  must.push('このページを開いた画面（出現時刻・方角・高さ）。電波が弱い場所もあるのでスクリーンショットを1枚');
  const month = new Date(o.date.getTime() + 9 * 3600e3).getUTCMonth() + 1;
  const t = o.tempC;
  if (t != null) {
    if (t <= 5) must.push(`厚手の防寒着・手袋・ニット帽・カイロ（観測時刻の気温 ${t.toFixed(0)}℃。立ち止まって待つので体感はさらに低い）`);
    else if (t <= 12) must.push(`上着とマフラーなど首元の防寒（観測時刻の気温 ${t.toFixed(0)}℃。じっと待つと冷える）`);
    else if (t <= 18) nice.push(`薄手の上着（観測時刻の気温 ${t.toFixed(0)}℃。日没後は下がる）`);
    else if (t >= 26) must.push(`飲み物（観測時刻の気温 ${t.toFixed(0)}℃。夜でも暑い）`);
  } else {
    nice.push('日没後は冷えるので、季節より1枚多めの上着');
  }
  if (o.precip > 0 || o.precipProb >= 30) must.push(`折りたたみ傘かレインウェア（行き帰りの降水確率 ${o.precipProb}%）。観測中は傘より両手が空くレインウェアが楽`);
  if (o.wind >= 8) nice.push(`風よけになる上着（風速 ${o.wind.toFixed(0)}m/s の予報。河川敷や海辺は特に強い）`);
  if (month >= 5 && month <= 10) must.push('虫よけ（河川敷・公園・海辺は蚊が多い）');
  if (['河川敷', '海浜公園', '海岸', '公園'].includes(o.siteType)) nice.push('レジャーシートか折りたたみ椅子（土手や芝生で座って待てる。見上げ続けると首が疲れる）');
  nice.push('小さな懐中電灯かヘッドライト（足元用。空を見るときは消す。赤いセロハンを貼ると目が暗さに慣れたまま）');
  nice.push('双眼鏡は不要。肉眼で十分見え、むしろ視野が狭くて追いにくい');
  nice.push('カメラで撮るなら三脚と、シャッター速度を数秒にできる設定（スマホなら夜景モードで長めの露光）');
  if (o.overnight) {
    must.push('始発まで過ごす場所の当て（24時間営業の店、駅前の待合）。公園で夜通し待つのは避ける');
    must.push('真冬でなくても夜明け前は一日で最も冷える。防寒は昼間の感覚より2段階上');
    must.push('家族や同居人に行き先と帰宅予定を伝えておく');
    nice.push('温かい飲み物を入れた水筒');
  }
  return { must, nice };
}
