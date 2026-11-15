// RFC 6238 code for a base32 secret: node totp.mjs <secret> [step offset]. For the real-API gate only.
import { createHmac } from 'node:crypto';
const b32 = (s) => {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase())
    bits += a.indexOf(c).toString(2).padStart(5, '0');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
};
const secret = process.argv[2];
const step = BigInt(Math.floor(Date.now() / 1000 / 30) + Number(process.argv[3] ?? 0));
const msg = Buffer.alloc(8);
msg.writeBigUInt64BE(step);
const h = createHmac('sha1', b32(secret)).update(msg).digest();
const o = h[h.length - 1] & 15;
console.log(String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0'));
