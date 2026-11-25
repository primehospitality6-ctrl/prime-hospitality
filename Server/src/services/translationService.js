/**
 * Automatic translation of website text (English ↔ Arabic).
 *
 * Detects what still needs translating (text in Arabic is never sent for Arabic, and the reverse),
 * translates each distinct text once, and keeps it in the `translations` table so every later
 * visitor gets it instantly. A translation typed by staff (manual) is never replaced.
 *
 * Engine: Google Cloud Translation when GOOGLE_TRANSLATE_API_KEY is set; otherwise Google's free
 * public endpoint. A daily limit on new characters (TRANSLATE_DAILY_CHAR_LIMIT) protects either one.
 */

const crypto = require('crypto');
const { getTranslations, saveTranslations } = require('../lib/cmsStore');

const LANGS = new Set(['ar', 'en']);
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-z]/g;

const MAX_TEXT = 2000;
const DAILY_LIMIT = () => Number(process.env.TRANSLATE_DAILY_CHAR_LIMIT) || 400000;

/** Brand names Google leaves in Latin inside Arabic sentences → the site's Arabic forms. */
const BRAND_AR = [
  [/\bPrime Residence\b/g, 'برايم ريزيدنس'],
  [/\bPrime Select\b/g, 'برايم سيليكت'],
  [/\bPrime Holidays?\b/g, 'برايم هوليدايز'],
  [/\bPrime Inn\b/g, 'برايم إن'],
  [/\bPrime Boutique\b/g, 'برايم بوتيك'],
  [/\bPrime Hospitality\b/g, 'برايم للضيافة'],
];

const idOf = (lang, text) => crypto.createHash('sha1').update(`${lang}\u0000${text}`).digest('hex');
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Does this text need translating into `to`? */
function needsTranslation(text, to) {
  const s = clean(text);
  if (!s || s.length > MAX_TEXT) return false;
  if (to === 'ar') return !ARABIC.test(s) && (s.match(LATIN) || []).length >= 2;
  return ARABIC.test(s);
}

/* ——— memory cache (most recent texts) ——— */
const memory = new Map();
const MEMORY_MAX = 20000;
function remember(id, value) {
  if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value);
  memory.set(id, value);
}

/* ——— daily budget for new text ——— */
let budget = { day: '', used: 0 };
function takeBudget(chars) {
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) budget = { day, used: 0 };
  if (budget.used + chars > DAILY_LIMIT()) return false;
  budget.used += chars;
  return true;
}

/* ——— engines ——— */
async function googleOfficial(texts, to, from) {
  const key = String(process.env.GOOGLE_TRANSLATE_API_KEY || '').trim();
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target: to, source: from, format: 'text' }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.data?.translations)) throw new Error(`Google Translate ${res.status}: ${JSON.stringify(data?.error || data).slice(0, 200)}`);
  return data.data.translations.map((t) => t.translatedText);
}

async function googleFree(texts, to, from) {
  const body = new URLSearchParams();
  for (const t of texts) body.append('q', t);
  const res = await fetch(`https://translate.googleapis.com/translate_a/t?client=gtx&sl=${from}&tl=${to}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data)) throw new Error(`free translate ${res.status}`);
  // One text comes back as a plain string; several as an array (sometimes [text, lang] pairs).
  const list = texts.length === 1 && typeof data[0] === 'string' && data.length !== 1 ? [data[0]] : data;
  return list.map((item) => (Array.isArray(item) ? item[0] : item));
}

function engine() {
  return String(process.env.GOOGLE_TRANSLATE_API_KEY || '').trim() ? { name: 'google', run: googleOfficial } : { name: 'google-free', run: googleFree };
}

function finish(translated, to) {
  let out = String(translated || '').trim();
  if (to === 'ar') for (const [re, ar] of BRAND_AR) out = out.replace(re, ar);
  return out;
}

/** Translate in batches of up to ~4,000 characters (the engines' comfortable request size). */
async function runBatches(texts, to) {
  const from = to === 'ar' ? 'en' : 'ar';
  const { name, run } = engine();
  const out = [];
  let batch = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const result = await run(batch, to, from);
    if (result.length !== batch.length) throw new Error(`translation returned ${result.length} of ${batch.length}`);
    out.push(...result.map((r) => finish(r, to)));
    batch = [];
    size = 0;
  };
  for (const t of texts) {
    if (size + t.length > 4000 || batch.length >= 100) await flush();
    batch.push(t);
    size += t.length;
  }
  await flush();
  return { results: out, provider: name };
}

/**
 * Translate many texts into `to` ('ar' | 'en'). Returns an array aligned with `texts`:
 * the translation, or the original text when it needs none or cannot be translated now.
 */
async function translateTexts(texts, to) {
  if (!LANGS.has(to)) throw Object.assign(new Error('Unsupported language'), { status: 400 });
  const input = (texts || []).map((t) => String(t ?? ''));
  const result = input.slice();
  const todo = new Map(); // id → clean text
  input.forEach((raw) => {
    const s = clean(raw);
    if (needsTranslation(s, to)) todo.set(idOf(to, s), s);
  });
  if (!todo.size) return result;

  const found = new Map();
  for (const [id] of todo) if (memory.has(id)) found.set(id, memory.get(id));
  const unknown = [...todo.keys()].filter((id) => !found.has(id));
  if (unknown.length) {
    try {
      for (const row of await getTranslations(unknown)) {
        found.set(row.id, row.translated);
        remember(row.id, row.translated);
      }
    } catch (err) {
      console.warn('[translate] cache read failed:', err.message);
    }
  }

  const missing = [...todo.entries()].filter(([id]) => !found.has(id));
  const chars = missing.reduce((n, [, s]) => n + s.length, 0);
  if (missing.length && takeBudget(chars)) {
    try {
      const { results, provider } = await runBatches(missing.map(([, s]) => s), to);
      const rows = missing.map(([id, s], i) => ({ id, lang: to, source: s, translated: results[i] || s, provider }));
      for (const row of rows) {
        found.set(row.id, row.translated);
        remember(row.id, row.translated);
      }
      saveTranslations(rows).catch((err) => console.warn('[translate] cache write failed:', err.message));
    } catch (err) {
      budget.used = Math.max(0, budget.used - chars);
      console.warn('[translate] engine failed:', err.message);
    }
  } else if (missing.length) {
    console.warn(`[translate] daily limit reached — ${missing.length} text(s) left untranslated today`);
  }

  input.forEach((raw, i) => {
    const s = clean(raw);
    const hit = found.get(idOf(to, s));
    if (hit) result[i] = hit;
  });
  return result;
}

/** Staff-typed translation: replaces the automatic one and is never overwritten. */
async function setManualTranslation(source, to, translated) {
  const s = clean(source);
  const id = idOf(to, s);
  const row = { id, lang: to, source: s, translated: clean(translated), provider: 'manual', manual: true };
  await saveTranslations([row]);
  remember(id, row.translated);
  return row;
}

module.exports = { translateTexts, needsTranslation, setManualTranslation, MAX_TEXT };
