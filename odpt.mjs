// ODPT の列車運行情報。アクセストークンは端末の localStorage にだけ保存する（リポジトリには入れない）
// 公開 API（東京メトロ・都営・りんかい線・多摩モノレール・横浜市営など）とチャレンジ API（JR東日本・東急・京急・京王・西武・東武など）で
// 提供事業者が違うので、両方のトークンを持てるようにする
const ENDPOINTS = [
  { key: 'odptToken', base: 'https://api.odpt.org/api/v4', label: '公開API' },
  { key: 'odptChallengeToken', base: 'https://api-challenge.odpt.org/api/v4', label: 'チャレンジAPI' },
];
const KEY = ENDPOINTS[0].key;

export function getToken(which = 0) { try { return localStorage.getItem(ENDPOINTS[which].key) || ''; } catch { return ''; } }
export function setToken(t, which = 0) { try { t ? localStorage.setItem(ENDPOINTS[which].key, t.trim()) : localStorage.removeItem(ENDPOINTS[which].key); } catch { /* ignore */ } }
export function hasAnyToken() { return !!(getToken(0) || getToken(1)); }

// 路線名（sites.json / stations.json の表記）→ odpt:Railway ID
export const RAILWAY_IDS = {
  'JR山手線': 'odpt.Railway:JR-East.Yamanote',
  'JR中央線': 'odpt.Railway:JR-East.ChuoRapid',
  'JR総武線': 'odpt.Railway:JR-East.ChuoSobuLocal',
  'JR総武快速線': 'odpt.Railway:JR-East.SobuRapid',
  'JR京葉線': 'odpt.Railway:JR-East.Keiyo',
  'JR埼京線': 'odpt.Railway:JR-East.SaikyoKawagoe',
  'JR横浜線': 'odpt.Railway:JR-East.Yokohama',
  'JR武蔵野線': 'odpt.Railway:JR-East.Musashino',
  'JR相模線': 'odpt.Railway:JR-East.Sagami',
  'JR京浜東北線': 'odpt.Railway:JR-East.KeihinTohokuNegishi',
  'JR東海道線': 'odpt.Railway:JR-East.Tokaido',
  'JR横須賀線': 'odpt.Railway:JR-East.Yokosuka',
  'JR常磐線': 'odpt.Railway:JR-East.JobanRapid',
  'JR南武線': 'odpt.Railway:JR-East.Nambu',
  'JR宇都宮線': 'odpt.Railway:JR-East.Utsunomiya',
  'JR高崎線': 'odpt.Railway:JR-East.Takasaki',
  '東京メトロ南北線': 'odpt.Railway:TokyoMetro.Namboku',
  '東京メトロ千代田線': 'odpt.Railway:TokyoMetro.Chiyoda',
  '東京メトロ有楽町線': 'odpt.Railway:TokyoMetro.Yurakucho',
  '東京メトロ丸ノ内線': 'odpt.Railway:TokyoMetro.Marunouchi',
  '東京メトロ銀座線': 'odpt.Railway:TokyoMetro.Ginza',
  '東京メトロ日比谷線': 'odpt.Railway:TokyoMetro.Hibiya',
  '東京メトロ半蔵門線': 'odpt.Railway:TokyoMetro.Hanzomon',
  '東京メトロ副都心線': 'odpt.Railway:TokyoMetro.Fukutoshin',
  '都営大江戸線': 'odpt.Railway:Toei.Oedo',
  '都営新宿線': 'odpt.Railway:Toei.Shinjuku',
  '日暮里・舎人ライナー': 'odpt.Railway:Toei.NipporiToneri',
  '東急田園都市線': 'odpt.Railway:Tokyu.DenEnToshi',
  '東急東横線': 'odpt.Railway:Tokyu.Toyoko',
  '東急大井町線': 'odpt.Railway:Tokyu.Oimachi',
  '東急目黒線': 'odpt.Railway:Tokyu.Meguro',
  '東急多摩川線': 'odpt.Railway:Tokyu.TokyuTamagawa',
  '東急新横浜線': 'odpt.Railway:Tokyu.TokyuShinYokohama',
  '京急本線': 'odpt.Railway:Keikyu.Main',
  '京成本線': 'odpt.Railway:Keisei.Main',
  '小田急小田原線': 'odpt.Railway:Odakyu.Odawara',
  '小田急江ノ島線': 'odpt.Railway:Odakyu.Enoshima',
  '西武新宿線': 'odpt.Railway:Seibu.Shinjuku',
  '西武池袋線': 'odpt.Railway:Seibu.Ikebukuro',
  '西武多摩川線': 'odpt.Railway:Seibu.Tamagawa',
  '京王井の頭線': 'odpt.Railway:Keio.Inokashira',
  '京王線': 'odpt.Railway:Keio.Keio',
  'ゆりかもめ': 'odpt.Railway:Yurikamome.Yurikamome',
  'りんかい線': 'odpt.Railway:TWR.Rinkai',
  '東京モノレール': 'odpt.Railway:TokyoMonorail.HanedaAirport',
  '多摩モノレール': 'odpt.Railway:TamaMonorail.TamaMonorail',
  '埼玉高速鉄道': 'odpt.Railway:SaitamaRailway.SaitamaRailway',
  'みなとみらい線': 'odpt.Railway:YokohamaMinatomiraiRailway.Minatomirai',
  '横浜市営地下鉄': 'odpt.Railway:YokohamaMunicipal.Blue',
  'つくばエクスプレス': 'odpt.Railway:MIR.TsukubaExpress',
  '東武スカイツリーライン': 'odpt.Railway:Tobu.TobuSkytree',
  '東武東上線': 'odpt.Railway:Tobu.Tojo',
  '東武野田線': 'odpt.Railway:Tobu.TobuUrbanPark',
  'JR青梅線': 'odpt.Railway:JR-East.Ome',
  'JR八高線': 'odpt.Railway:JR-East.Hachiko',
  'JR外房線': 'odpt.Railway:JR-East.Sotobo',
  'JR内房線': 'odpt.Railway:JR-East.Uchibo',
};

const DELAY_WORDS = ['遅れ', '遅延', '見合わせ', '運休', '運転を見合', '折り返し運転', '直通運転を中止', 'ダイヤが乱れ'];
const NORMAL_WORDS = ['平常', 'ありません', '通常どおり', '通常通り'];
export const isDelayText = (t) => !!t && DELAY_WORDS.some((w) => t.includes(w));

/**
 * 運行情報の文面を 3 段階に分類する
 *  - delayed: いま遅れ・見合わせ・運休が出ている（最初の一文に異常語があり、平常の語がない）
 *  - notice : いまは平常だが、お知らせで今後の乱れなどに触れている
 *  - normal : 平常
 */
export function classify(text, status) {
  const t = String(text ?? '');
  const first = t.split(/[。【\n]/)[0];
  const firstNormal = NORMAL_WORDS.some((w) => first.includes(w));
  const firstDelay = isDelayText(first) && !first.includes('ありません');
  if (firstDelay && !firstNormal) return 'delayed';
  if (isDelayText(t) || isDelayText(status)) return 'notice';
  return 'normal';
}

let cache = { at: 0, data: null };

/**
 * 全事業者の運行情報を取得（60秒キャッシュ）。トークンが無ければ null
 */
export async function fetchTrainInformation() {
  if (!hasAnyToken()) return null;
  if (cache.data && Date.now() - cache.at < 60e3) return cache.data;
  const results = await Promise.all(ENDPOINTS.map(async (ep, i) => {
    const token = getToken(i);
    if (!token) return [];
    const res = await fetch(`${ep.base}/odpt:TrainInformation?acl:consumerKey=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error(`ODPT ${ep.label} ${res.status}`);
    return res.json();
  }));
  const data = results.flat();
  cache = { at: Date.now(), data };
  return data;
}

/**
 * 路線名の配列について、運行情報を照合する
 * @returns {Promise<Array<{line:string, supported:boolean, text:string|null, delayed:boolean}>|null>}
 */
export async function lineStatuses(lineNames) {
  const all = await fetchTrainInformation();
  if (!all) return null;
  return lineNames.map((line) => {
    const id = RAILWAY_IDS[line];
    if (!id) return { line, supported: false, text: null, delayed: false };
    const operator = id.replace('odpt.Railway:', 'odpt.Operator:').split('.').slice(0, 2).join('.');
    const hit = all.find((x) => x['odpt:railway'] === id)
      ?? all.find((x) => !x['odpt:railway'] && x['odpt:operator'] === operator);
    if (!hit) return { line, supported: false, text: null, delayed: false }; // 事業者が運行情報を出していない
    const text = hit['odpt:trainInformationText']?.ja ?? hit['odpt:trainInformationText'] ?? '';
    const status = hit['odpt:trainInformationStatus']?.ja ?? '';
    const level = classify(text, status);
    return { line, supported: true, text: String(text), status: String(status), level, delayed: level === 'delayed', notice: level === 'notice' };
  });
}
