// JWT の中身を表示するだけのデコーダ（署名検証は行わない）
import { b64Decode, fromBytes } from './codecs.js';

export function decodeJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length < 2) throw new Error('JWT は「ヘッダ.ペイロード.署名」の形式です');
  const parse = (p, label) => {
    try {
      return JSON.parse(fromBytes(b64Decode(p)));
    } catch {
      throw new Error(`${label}を JSON として読めませんでした`);
    }
  };
  const header = parse(parts[0], 'ヘッダ');
  const payload = parse(parts[1], 'ペイロード');
  const notes = [];
  const alg = String(header.alg ?? '');
  if (alg.toLowerCase() === 'none') notes.push('alg が none です（署名なしトークン）');
  if (alg.startsWith('HS')) notes.push(`共通鍵方式 (${alg}) です`);
  if (/^(RS|ES|PS)/.test(alg)) notes.push(`公開鍵方式 (${alg}) です`);
  if (header.kid !== undefined) notes.push(`kid ヘッダがあります: ${JSON.stringify(header.kid)}`);
  if (header.jku || header.x5u) notes.push('jku / x5u ヘッダ（鍵の取得先URL）があります');
  for (const k of ['iat', 'nbf', 'exp']) {
    if (typeof payload[k] === 'number') {
      notes.push(`${k}: ${new Date(payload[k] * 1000).toISOString()}`);
    }
  }
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) notes.push('有効期限 (exp) は切れています');
  return { header, payload, signature: parts[2] ?? '', notes };
}
