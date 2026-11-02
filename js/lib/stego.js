// 画像のビットプレーン表示と、最下位ビット（LSB）などに埋め込まれたデータの取り出し
// rgba は Canvas の ImageData.data と同じ並び（1画素 = R,G,B,A の4バイト）

// channel: 0=R 1=G 2=B 3=A、bit: 0（最下位）〜7（最上位）。ビットが1の画素を白、0を黒にした画像を返す
export function bitPlane(rgba, channel, bit) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const v = (rgba[i + channel] >> bit) & 1 ? 255 : 0;
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

// 1チャンネルだけを濃淡で表示
export function channelOnly(rgba, channel) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const v = rgba[i + channel];
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

const CH = { R: 0, G: 1, B: 2, A: 3 };

// channels: 'RGB' など、bits: [0] や [1, 0]（上位から順に読む）、order: 'row'（横方向）| 'col'（縦方向）、msbFirst: ビットを上位から詰めるか
export function extractBits(rgba, width, height, { channels = 'RGB', bits = [0], order = 'row', msbFirst = true, maxBytes = 1 << 20 } = {}) {
  const chs = Array.from(channels.toUpperCase(), (c) => CH[c]).filter((c) => c !== undefined);
  if (!chs.length) throw new Error('チャンネルを選んでください');
  const out = new Uint8Array(Math.min(maxBytes, Math.ceil((width * height * chs.length * bits.length) / 8)));
  let byte = 0, nbits = 0, n = 0;
  const push = (b) => {
    byte = msbFirst ? (byte << 1) | b : byte | (b << nbits);
    if (++nbits === 8) {
      out[n++] = byte & 255;
      byte = 0;
      nbits = 0;
    }
  };
  outer: for (let a = 0; a < (order === 'col' ? width : height); a++) {
    for (let b = 0; b < (order === 'col' ? height : width); b++) {
      const [x, y] = order === 'col' ? [a, b] : [b, a];
      const p = (y * width + x) * 4;
      for (const c of chs) {
        for (const bit of bits) {
          push((rgba[p + c] >> bit) & 1);
          if (n >= out.length) break outer;
        }
      }
    }
  }
  return out.subarray(0, n);
}

// テキストを LSB に埋め込む（サンプル作成・テスト用）
export function embedBits(rgba, width, height, data, { channels = 'RGB', bit = 0 } = {}) {
  const chs = Array.from(channels, (c) => CH[c]);
  let i = 0;
  const total = data.length * 8;
  for (let p = 0; p < width * height && i < total; p++) {
    for (const c of chs) {
      if (i >= total) break;
      const b = (data[i >> 3] >> (7 - (i & 7))) & 1;
      const idx = p * 4 + c;
      rgba[idx] = (rgba[idx] & ~(1 << bit)) | (b << bit);
      i++;
    }
  }
  return rgba;
}
