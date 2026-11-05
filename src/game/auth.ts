// Auth lokal (localStorage): username + password ter-hash (SHA-256 + salt acak).
// Tidak ada plaintext password yang disimpan. Sinkron antar perangkat butuh
// backend auth (mis. Firebase Auth / Supabase) — di luar cakupan save lokal ini.

export const AUTH_ACCOUNTS_KEY = 'fmco:accounts'; // sama seperti sebelumnya

export interface AccountRecord {
  name: string;
  createdAt: number;
  salt?: string; // hex; absen = akun lama (pra-password)
  passHash?: string; // hex SHA-256(salt + '::' + password)
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export function validateUsername(name: string): string | null {
  const n = name.trim();
  if (!USERNAME_RE.test(n)) return 'Username 3–20 karakter, hanya huruf/angka/_ (tanpa spasi).';
  return null;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 6) return 'Password minimal 6 karakter.';
  return null;
}

// ---------- SHA-256 (sync, public-domain style implementation) ----------
let H_CACHE: number[] | null = null;
let K_CACHE: number[] | null = null;

function sha256Hex(ascii: string): string {
  const rr = (v: number, a: number) => (v >>> a) | (v << (32 - a));
  const maxWord = Math.pow(2, 32);
  let result = '';
  const words: number[] = [];
  const bitLen = ascii.length * 8;
  let hash: number[] = H_CACHE ? [...H_CACHE] : [];
  let k: number[] = K_CACHE ? K_CACHE : [];
  if (!H_CACHE || !K_CACHE) {
    let pc = 0;
    const comp: Record<number, boolean> = {};
    for (let cand = 2; pc < 64; cand++) {
      if (!comp[cand]) {
        for (let i = 0; i < 313; i += cand) comp[i] = true;
        hash[pc] = (Math.pow(cand, 0.5) * maxWord) | 0;
        k[pc++] = (Math.pow(cand, 1 / 3) * maxWord) | 0;
      }
    }
    H_CACHE = [...hash];
    K_CACHE = k;
  }
  const msg = ascii + '\x80';
  const pad = msg + '\x00'.repeat((64 - ((msg.length + 8) % 64)) % 64);
  for (let i = 0; i < pad.length; i++) {
    const j = pad.charCodeAt(i);
    words[i >> 2] |= (j & 0xff) << (((3 - i) % 4) * 8);
  }
  words[words.length] = (bitLen / maxWord) | 0;
  words[words.length] = bitLen >>> 0;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const old = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15] | 0, w2 = w[i - 2] | 0;
      const a = hash[0], e = hash[4];
      const t1 = (hash[7]
        + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6]))
        + k[i]
        + (w[i] = i < 16 ? w[i] | 0 : (w[i - 16]
          + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
          + (w[i - 7] | 0)
          + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0)) | 0;
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash);
      hash[4] = (hash[4] + t1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function utf8ToBinary(s: string): string {
  // encodeURIComponent -> %XX, lalu tiap %XX jadi 1 char Latin-1
  return encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, h: string) =>
    String.fromCharCode(parseInt(h, 16)));
}

export function genSalt(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  try {
    crypto.getRandomValues(arr);
  } catch {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashPassword(password: string, salt: string): string {
  return sha256Hex(utf8ToBinary(salt + '::' + password));
}

// ---------- storage ----------
export function readAuthAccounts(): AccountRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(AUTH_ACCOUNTS_KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((a): a is AccountRecord =>
      !!a && typeof (a as AccountRecord).name === 'string');
  } catch {
    return [];
  }
}

export function writeAuthAccounts(list: AccountRecord[]) {
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(list));
}

export function findAuthAccount(list: AccountRecord[], name: string): AccountRecord | undefined {
  const n = name.trim().toLowerCase();
  return list.find((a) => a.name.trim().toLowerCase() === n);
}

export function verifyPassword(acc: AccountRecord, password: string): boolean {
  if (!acc.salt || !acc.passHash) return false;
  return hashPassword(password, acc.salt) === acc.passHash;
}
