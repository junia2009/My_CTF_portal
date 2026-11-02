// 位置特定アシスタント：画像から読み取った文字などから、場所の手がかりを取り出して地図検索のリンクを作る

export const mapLinks = (query) => ({
  google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  osm: `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`,
});
export const coordLinks = (lat, lon) => ({
  google: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
});

// 日本の主な市外局番（長いものから照合する）
const AREA_CODES = [
  ['0120', 'フリーダイヤル（地域は分からない）'], ['0570', 'ナビダイヤル（地域は分からない）'], ['0800', 'フリーダイヤル（地域は分からない）'],
  ['050', 'IP 電話（地域は分からない）'], ['070', '携帯電話（地域は分からない）'], ['080', '携帯電話（地域は分からない）'], ['090', '携帯電話（地域は分からない）'],
  ['011', '北海道 札幌市周辺'], ['0138', '北海道 函館市周辺'], ['0166', '北海道 旭川市周辺'], ['017', '青森県 青森市周辺'], ['019', '岩手県 盛岡市周辺'],
  ['022', '宮城県 仙台市周辺'], ['018', '秋田県 秋田市周辺'], ['023', '山形県 山形市周辺'], ['024', '福島県 福島市・郡山市周辺'],
  ['029', '茨城県 水戸市周辺'], ['028', '栃木県 宇都宮市周辺'], ['027', '群馬県 前橋市・高崎市周辺'], ['048', '埼玉県 さいたま市周辺'],
  ['043', '千葉県 千葉市周辺'], ['047', '千葉県 船橋市・松戸市周辺'], ['03', '東京都 23区'], ['042', '東京都 多摩地域・神奈川県 相模原市周辺'],
  ['045', '神奈川県 横浜市'], ['044', '神奈川県 川崎市'], ['046', '神奈川県 厚木市・横須賀市周辺'], ['0466', '神奈川県 藤沢市周辺'],
  ['025', '新潟県 新潟市周辺'], ['076', '石川県 金沢市・富山県 富山市周辺'], ['0776', '福井県 福井市周辺'], ['055', '山梨県 甲府市・静岡県 沼津市周辺'],
  ['026', '長野県 長野市周辺'], ['058', '岐阜県 岐阜市周辺'], ['054', '静岡県 静岡市周辺'], ['053', '静岡県 浜松市周辺'],
  ['052', '愛知県 名古屋市'], ['059', '三重県 津市・四日市市周辺'], ['077', '滋賀県 大津市周辺'], ['075', '京都府 京都市'],
  ['06', '大阪府 大阪市'], ['072', '大阪府 堺市・東大阪市周辺'], ['078', '兵庫県 神戸市'], ['079', '兵庫県 姫路市周辺'],
  ['0742', '奈良県 奈良市周辺'], ['073', '和歌山県 和歌山市周辺'], ['0857', '鳥取県 鳥取市周辺'], ['0852', '島根県 松江市周辺'],
  ['086', '岡山県 岡山市周辺'], ['082', '広島県 広島市'], ['083', '山口県 下関市・山口市周辺'], ['088', '徳島県・高知県（088）'],
  ['087', '香川県 高松市周辺'], ['089', '愛媛県 松山市周辺'], ['092', '福岡県 福岡市'], ['093', '福岡県 北九州市'],
  ['0952', '佐賀県 佐賀市周辺'], ['095', '長崎県 長崎市周辺'], ['096', '熊本県 熊本市周辺'], ['097', '大分県 大分市周辺'],
  ['0985', '宮崎県 宮崎市周辺'], ['099', '鹿児島県 鹿児島市周辺'], ['098', '沖縄県'],
].sort((a, b) => b[0].length - a[0].length);

export function phoneArea(number) {
  const d = number.replace(/\D/g, '');
  if (d.startsWith('81')) return phoneArea('0' + d.slice(2));
  return AREA_CODES.find(([code]) => d.startsWith(code))?.[1] ?? null;
}

// ドメインの国別コード（よく出るもの）
const CCTLD = { jp: '日本', kr: '韓国', cn: '中国', tw: '台湾', hk: '香港', sg: 'シンガポール', th: 'タイ', vn: 'ベトナム', id: 'インドネシア', ph: 'フィリピン', my: 'マレーシア', in: 'インド', au: 'オーストラリア', nz: 'ニュージーランド', uk: 'イギリス', de: 'ドイツ', fr: 'フランス', it: 'イタリア', es: 'スペイン', nl: 'オランダ', ru: 'ロシア', br: 'ブラジル', mx: 'メキシコ', ca: 'カナダ', us: 'アメリカ' };

// 文字の種類から言語・地域を推定
const SCRIPTS = [
  ['ひらがな・カタカナ', /[぀-ヿ]/g, '日本'],
  ['ハングル', /[가-힯]/g, '韓国'],
  ['タイ文字', /[฀-๿]/g, 'タイ'],
  ['キリル文字', /[Ѐ-ӿ]/g, 'ロシア・東欧・中央アジア'],
  ['アラビア文字', /[؀-ۿ]/g, '中東・北アフリカ'],
  ['デーヴァナーガリー', /[ऀ-ॿ]/g, 'インド・ネパール'],
  ['ギリシャ文字', /[Ͱ-Ͽ]/g, 'ギリシャ・キプロス'],
  ['ヘブライ文字', /[֐-׿]/g, 'イスラエル'],
  ['漢字', /[一-鿿]/g, '日本・中国・台湾など'],
];

// 度分秒（35°41'22"N）または 10 進（35.6895, 139.6917）の座標
export function parseCoords(text) {
  const out = [];
  for (const m of text.matchAll(/(-?\d{1,2}\.\d{3,})\s*[,，\s]\s*(-?\d{1,3}\.\d{3,})/g)) {
    const lat = +m[1], lon = +m[2];
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) out.push({ lat, lon, raw: m[0] });
  }
  const dms = /(\d{1,3})[°度]\s*(\d{1,2})['′分]\s*(\d{1,2}(?:\.\d+)?)?["″秒]?\s*([NSEW北南東西])/g;
  const parts = [...text.matchAll(dms)].map((m) => {
    let v = +m[1] + +m[2] / 60 + (m[3] ? +m[3] / 3600 : 0);
    const d = m[4];
    if ('SW南西'.includes(d)) v = -v;
    return { v, axis: 'NS北南'.includes(d) ? 'lat' : 'lon', raw: m[0] };
  });
  for (let i = 0; i + 1 < parts.length; i++) {
    if (parts[i].axis === 'lat' && parts[i + 1].axis === 'lon') {
      out.push({ lat: +parts[i].v.toFixed(6), lon: +parts[i + 1].v.toFixed(6), raw: `${parts[i].raw} ${parts[i + 1].raw}` });
      i++;
    }
  }
  return out;
}

const uniq = (arr, key = (x) => x) => [...new Map(arr.map((x) => [key(x), x])).values()];

export function extractClues(text) {
  const t = text.replace(/[ \t]+/g, ' ');
  // OCR は「南幸 1 丁目」のように漢字と数字の間に空白を入れがちなので詰める
  const norm = t.normalize('NFKC').replace(/(?<=[\u3040-\u9fff])[ \t]+(?=[\d\u3040-\u9fff])|(?<=\d)[ \t]+(?=[\u3040-\u9fff])/g, '');
  const clues = [];
  const add = (type, value, note, query) => clues.push({ type, value, note, query: query ?? value });

  // 座標
  for (const c of parseCoords(norm)) clues.push({ type: '座標', value: `${c.lat}, ${c.lon}`, note: c.raw, coords: c });
  // 郵便番号（日本）
  for (const m of norm.matchAll(/(?:〒|郵便番号\s*)\s*(\d{3})-?(\d{4})/g)) {
    clues.push({ type: '郵便番号', value: `〒${m[1]}-${m[2]}`, note: '日本郵便で住所を調べられます', query: `〒${m[1]}-${m[2]}`, extra: { label: '日本郵便で検索', url: `https://www.post.japanpost.jp/cgi-zip/zipcode.php?zip=${m[1]}${m[2]}` } });
  }
  // 電話番号
  for (const m of norm.matchAll(/(?:TEL|Tel|tel|電話|☎)?[\s:：.]*((?:\+81[\s-]?|0)\d{1,4}[-(（\s]\d{1,4}[-)）\s]\d{3,4})/g)) {
    const num = m[1].replace(/[()（）\s]/g, '-').replace(/-+/g, '-');
    const area = phoneArea(num);
    add('電話番号', num, area ? `市外局番から：${area}` : '市外局番が分かりません', num);
  }
  // 住所（都道府県〜市区町村〜番地）
  for (const m of norm.matchAll(/((?:東京都|北海道|(?:京都|大阪)府|[^\s、。,]{2,3}県)[^\s、。,]{1,20}?[市区町村郡][^\s、。,]{0,24}?(?:\d+丁目|\d+番地?|\d+-\d+(?:-\d+)?|[^\s、。,]{0,8}))/g)) {
    add('住所', m[1].trim(), '住所表記');
  }
  // 駅・バス停・空港・港など
  for (const m of norm.matchAll(/([\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}A-Za-z]{1,12}(?:駅|バス停|停留所|空港|港|インター|IC|SA|PA|交差点|橋|トンネル|神社|寺|城|公園|大学|病院|郵便局|市役所|区役所|町役場))/gu)) {
    add('施設・地名', m[1], '地図で検索できる名前');
  }
  // URL・ドメイン
  for (const m of norm.matchAll(/\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+([a-z]{2,6}))(?:\/[^\s]*)?/gi)) {
    const tld = m[2].toLowerCase();
    if (/^\d+$/.test(tld) || /\.(png|jpe?g|gif|html?)$/i.test(m[1])) continue;
    add('URL・ドメイン', m[1], CCTLD[tld] ? `国別コード .${tld} → ${CCTLD[tld]}` : '公式サイトなら所在地が載っていることも', m[1]);
  }
  // 英字の看板（大文字の連続など）は、そのまま地図で検索してみる候補にする
  for (const m of norm.matchAll(/\b([A-Z][A-Za-z&'.-]+(?:[ \t]+[A-Z][A-Za-z&'.-]+){1,4})\b/g)) {
    if (m[1].length >= 6) add('英字の名称', m[1], '店名・建物名かもしれません');
  }

  const scripts = SCRIPTS.map(([name, re, region]) => ({ name, region, count: (t.match(re) ?? []).length })).filter((s) => s.count > 0);
  // 漢字だけの場合は、ひらがな・カタカナがあれば日本の可能性が高い
  const hints = [];
  if (scripts.some((s) => s.name === 'ひらがな・カタカナ')) hints.push('ひらがな・カタカナがあるので、日本の可能性が高いです');
  else if (scripts.some((s) => s.name === '漢字')) hints.push('漢字だけなので、中国・台湾・香港の可能性も考えましょう（簡体字なら中国本土）');
  for (const s of scripts) if (s.name !== '漢字' && s.name !== 'ひらがな・カタカナ') hints.push(`${s.name}があるので、${s.region}の可能性があります`);

  return { clues: uniq(clues, (c) => `${c.type}|${c.value}`), scripts, hints };
}

// 人が見るべき手がかりのチェックリスト
export const CHECKLIST = [
  ['文字', ['看板・店名・電話番号・住所表示を探す（OCR で読み取れなければ拡大して手で）', '言語と文字の種類（簡体字 / 繁体字、ハングル、キリル文字…）', 'URL・SNS アカウント・QR コード']],
  ['道路', ['車は左側通行か右側通行か（日本・英国・豪州などは左）', '道路標識の形と色（日本の止まれは逆三角形、欧州は青い丸の標識が多い）', 'センターライン・路肩の線の色（黄色か白か）', 'ナンバープレートの形と色・地名表示']],
  ['街並み', ['電柱と電線の多さ（日本は電柱が非常に多い）', 'ガードレール・ボラード（車止め）・マンホールの形', '信号機の形（縦型か横型か、日本は横型が多いが雪国は縦型）', '建物の様式・屋根の形・窓の格子']],
  ['自然', ['植生（ヤシの木・針葉樹・竹など）と土の色', '山の形・海や川の位置・遠くに見えるランドマーク', '雪の有無・季節感']],
  ['時間と光', ['影の向きと長さ（北半球では南中時に影が北を向く）', '撮影日時（EXIF）と昼夜・季節が合っているか', '空の色・天気']],
  ['検索のコツ', ['特徴的な建物は画像の一部だけを切り出して逆引き検索する', '地名候補が出たら Google マップのストリートビューで見比べる', '店名はチェーン店なら店舗一覧から絞り込む']],
];
