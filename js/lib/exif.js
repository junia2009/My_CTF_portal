// 画像のメタデータ：JPEG の EXIF / XMP / コメント、PNG のテキストチャンク・eXIf
import { parsePng } from './file.js';

const TAGS = {
  0x010e: 'ImageDescription', 0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x011a: 'XResolution', 0x011b: 'YResolution',
  0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist', 0x8298: 'Copyright', 0x9c9b: 'XPTitle', 0x9c9c: 'XPComment', 0x9c9d: 'XPAuthor',
  0x9c9e: 'XPKeywords', 0x9c9f: 'XPSubject',
  0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8827: 'ISO', 0x9000: 'ExifVersion', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal', 0x920a: 'FocalLength', 0x927c: 'MakerNote', 0x9286: 'UserComment',
  0xa002: 'PixelXDimension', 0xa003: 'PixelYDimension', 0xa420: 'ImageUniqueID', 0xa430: 'CameraOwnerName', 0xa431: 'BodySerialNumber',
  0xa433: 'LensMake', 0xa434: 'LensModel',
};
const GPS_TAGS = {
  0: 'GPSVersionID', 1: 'GPSLatitudeRef', 2: 'GPSLatitude', 3: 'GPSLongitudeRef', 4: 'GPSLongitude', 5: 'GPSAltitudeRef', 6: 'GPSAltitude',
  7: 'GPSTimeStamp', 18: 'GPSMapDatum', 29: 'GPSDateStamp',
};
const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 11: 4, 12: 8 };

function readTiff(b, start, group, out) {
  if (start + 8 > b.length) return null;
  const le = b[start] === 0x49;
  const u16 = (o) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const i32 = (o) => u32(o) | 0;
  const gps = {};

  function value(type, count, off) {
    const size = (SIZES[type] ?? 1) * count;
    const p = size <= 4 ? off : start + u32(off);
    if (p + size > b.length) return null;
    switch (type) {
      case 2: return new TextDecoder().decode(b.subarray(p, p + count)).replace(/\0+$/, '');
      case 3: return count === 1 ? u16(p) : Array.from({ length: count }, (_, i) => u16(p + i * 2));
      case 4: return count === 1 ? u32(p) : Array.from({ length: count }, (_, i) => u32(p + i * 4));
      case 9: return i32(p);
      case 5: case 10: {
        const r = Array.from({ length: count }, (_, i) => {
          const n = type === 5 ? u32(p + i * 8) : i32(p + i * 8), d = type === 5 ? u32(p + i * 8 + 4) : i32(p + i * 8 + 4);
          return d ? n / d : 0;
        });
        return count === 1 ? r[0] : r;
      }
      case 1: case 7: return b.subarray(p, p + Math.min(count, 256));
      default: return null;
    }
  }

  function ifd(off, grp, names) {
    if (off + 2 > b.length) return;
    const n = u16(off);
    for (let i = 0; i < n && i < 500; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > b.length) return;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      if (tag === 0x8769) { ifd(start + u32(e + 8), 'EXIF', TAGS); continue; }
      if (tag === 0x8825) { ifd(start + u32(e + 8), 'GPS', GPS_TAGS); continue; }
      const name = names[tag];
      if (!name) continue;
      let v = value(type, count, e + 8);
      if (v === null) continue;
      if (/^XP/.test(name) && v instanceof Uint8Array) v = new TextDecoder('utf-16le').decode(v).replace(/\0+$/, '');
      else if (name === 'UserComment' && v instanceof Uint8Array) v = new TextDecoder().decode(v.subarray(8)).replace(/\0+$/, '');
      else if (v instanceof Uint8Array) v = Array.from(v.subarray(0, 32), (x) => x.toString(16).padStart(2, '0')).join(' ');
      if (grp === 'GPS') gps[name] = v;
      out.push({ group: grp, name, value: Array.isArray(v) ? v.map((x) => +Number(x).toFixed(6)).join(', ') : String(v) });
    }
  }
  ifd(start + u32(start + 4), group, TAGS);

  const dms = (a) => (Array.isArray(a) ? a[0] + a[1] / 60 + a[2] / 3600 : null);
  const lat = dms(gps.GPSLatitude), lon = dms(gps.GPSLongitude);
  if (lat == null || lon == null) return null;
  return { lat: gps.GPSLatitudeRef === 'S' ? -lat : lat, lon: gps.GPSLongitudeRef === 'W' ? -lon : lon };
}

export async function readMetadata(bytes) {
  const out = [];
  let gps = null;
  const td = new TextDecoder();
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= bytes.length && bytes[i] === 0xff) {
      const m = bytes[i + 1];
      if (m === 0xda || m === 0xd9) break;
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      const seg = bytes.subarray(i + 4, i + 2 + len);
      if (m === 0xe1 && td.decode(seg.subarray(0, 6)) === 'Exif\0\0') gps = readTiff(bytes, i + 10, 'TIFF', out) ?? gps;
      else if (m === 0xe1 && td.decode(seg.subarray(0, 28)).startsWith('http://ns.adobe.com/xap/1.0/')) {
        out.push({ group: 'XMP', name: 'XMP', value: td.decode(seg.subarray(29)).slice(0, 4000) });
      } else if (m === 0xfe) out.push({ group: 'JPEG', name: 'Comment', value: td.decode(seg) });
      i += 2 + len;
    }
  } else {
    const png = parsePng(bytes);
    if (png) {
      if (png.info) out.push({ group: 'PNG', name: 'Size', value: `${png.info.width} × ${png.info.height}` });
      for (const c of png.chunks) {
        const data = bytes.subarray(c.offset + 8, c.offset + 8 + c.length);
        if (c.type === 'tEXt') {
          const z = data.indexOf(0);
          out.push({ group: 'PNG tEXt', name: td.decode(data.subarray(0, z)), value: new TextDecoder('latin1').decode(data.subarray(z + 1)) });
        } else if (c.type === 'zTXt' || c.type === 'iTXt') {
          const z = data.indexOf(0);
          const key = td.decode(data.subarray(0, z));
          let text = '';
          try {
            if (c.type === 'zTXt') text = await inflate(data.subarray(z + 2));
            else {
              const compressed = data[z + 1] === 1;
              let p = z + 3;
              p = data.indexOf(0, p) + 1; // 言語タグ
              p = data.indexOf(0, p) + 1; // 翻訳キーワード
              text = compressed ? await inflate(data.subarray(p)) : td.decode(data.subarray(p));
            }
          } catch {
            text = '(展開できませんでした)';
          }
          out.push({ group: `PNG ${c.type}`, name: key, value: text });
        } else if (c.type === 'eXIf') {
          gps = readTiff(bytes, c.offset + 8, 'TIFF', out) ?? gps;
        } else if (c.type === 'tIME' && c.length === 7) {
          const y = (data[0] << 8) | data[1];
          out.push({ group: 'PNG', name: '最終更新', value: `${y}-${data[2]}-${data[3]} ${data[4]}:${data[5]}:${data[6]}` });
        }
      }
    }
  }
  return { entries: out, gps };
}

async function inflate(data) {
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new TextDecoder().decode(await new Response(s).arrayBuffer());
}
