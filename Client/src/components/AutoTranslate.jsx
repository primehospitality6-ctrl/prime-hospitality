import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiBase } from '../api/client';
import { useLocale } from '../context/LocaleContext';

/**
 * Arabic everywhere, automatically. While the site is in Arabic, every visible text, placeholder,
 * tooltip and label that has no Arabic in it (unit and property names, descriptions, amenities, text
 * typed in the admin, anything new) is sent once to /api/i18n/translate and swapped in place. The
 * server keeps each translation, so after the first visitor it is instant. English comes back the
 * moment the guest switches language. Mark anything that must stay as written with translate="no".
 */

const BASE = apiBase(import.meta.env.VITE_API_URL);
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'IFRAME', 'TEMPLATE']);
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const STORE_KEY = 'prime.tr.ar.v1';
const STORE_MAX = 4000;

/** Text worth translating: has real words, no Arabic, and is not a number, price, email, phone or link. */
function wanted(text) {
  const s = text.trim();
  if (s.length < 2 || s.length > 2000 || ARABIC.test(s)) return false;
  if ((s.match(/[A-Za-z]/g) || []).length < 2) return false;
  if (/^(https?:\/\/|www\.)\S+$/i.test(s) || /^\S+@\S+\.\S+$/.test(s)) return false;
  if (/^[+\d\s()./:-]+$/.test(s)) return false;
  if (/^[\d\s.,]*\s?(USD|EGP|EUR|SAR|AED|GBP)$/i.test(s) || /^(USD|EGP|EUR|SAR|AED|GBP)\s?[\d.,]+$/i.test(s)) return false;
  return true;
}

function excluded(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    if (node.getAttribute('translate') === 'no' || node.classList?.contains('notranslate') || node.hasAttribute('data-no-translate')) return true;
    if (node.isContentEditable) return true;
  }
  return false;
}

/* ——— cache: memory + this browser ——— */
const cache = new Map();
function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    for (const [k, v] of saved) cache.set(k, v);
  } catch {
    /* private mode or bad data */
  }
}
let saveTimer = null;
function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...cache.entries()].slice(-STORE_MAX)));
    } catch {
      /* storage full or blocked */
    }
  }, 800);
}

/* ——— batched requests ——— */
const waiting = new Set();
let flushTimer = null;
let inFlight = false;
let onArrive = () => {};

function request(text) {
  if (cache.has(text) || waiting.has(text)) return;
  waiting.add(text);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 120);
}

async function flush() {
  if (inFlight || !waiting.size) return;
  inFlight = true;
  const batch = [];
  let chars = 0;
  for (const t of waiting) {
    if (batch.length >= 150 || chars + t.length > 30000) break;
    batch.push(t);
    chars += t.length;
  }
  batch.forEach((t) => waiting.delete(t));
  try {
    const res = await fetch(`${BASE}/api/i18n/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'ar', texts: batch }),
    });
    const data = res.ok ? await res.json() : null;
    (data?.translations || []).forEach((tr, i) => {
      if (typeof tr === 'string' && tr.trim()) cache.set(batch[i], tr.trim());
    });
    saveStore();
    onArrive();
  } catch {
    /* offline: the English stays */
  } finally {
    inFlight = false;
    if (waiting.size) flushTimer = setTimeout(flush, 300);
  }
}

/* ——— swapping text in the page ——— */
const originals = new WeakMap(); // text node → its English
const attrOriginals = new WeakMap(); // element → { attr: English }

function keepSpaces(original, translated) {
  const lead = original.match(/^\s*/)[0];
  const trail = original.match(/\s*$/)[0];
  return lead + translated + trail;
}

function translateTextNode(node) {
  const value = node.nodeValue;
  if (!value || !value.trim()) return;
  const known = originals.get(node);
  // React (or anything) wrote new English into the node: that is the new original.
  const source = known && value === known.shown ? known.source : value;
  if (!wanted(source)) return;
  if (node.parentElement && excluded(node.parentElement)) return;
  const key = source.trim();
  const tr = cache.get(key);
  if (tr) {
    const shown = keepSpaces(source, tr);
    originals.set(node, { source, shown });
    if (node.nodeValue !== shown) node.nodeValue = shown;
  } else {
    request(key);
  }
}

function translateAttrs(el) {
  if (excluded(el)) return;
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const kept = attrOriginals.get(el) || {};
    const source = kept[attr] && value === kept[`${attr}:shown`] ? kept[attr] : value;
    if (!wanted(source)) continue;
    const tr = cache.get(source.trim());
    if (tr) {
      kept[attr] = source;
      kept[`${attr}:shown`] = tr;
      attrOriginals.set(el, kept);
      if (value !== tr) el.setAttribute(attr, tr);
    } else {
      request(source.trim());
    }
  }
}

function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) return translateTextNode(root);
  if (root.nodeType !== 1 || excluded(root)) return;
  translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && excluded(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) translateTextNode(n);
    else translateAttrs(n);
  }
}

/** Put the English back everywhere (guest switched to English). */
function restore(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) {
      const known = originals.get(n);
      if (known && n.nodeValue === known.shown) n.nodeValue = known.source;
      originals.delete(n);
    } else {
      const kept = attrOriginals.get(n);
      if (!kept) continue;
      for (const attr of ATTRS) if (kept[attr] && n.getAttribute(attr) === kept[`${attr}:shown`]) n.setAttribute(attr, kept[attr]);
      attrOriginals.delete(n);
    }
  }
}

export default function AutoTranslate() {
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const active = locale === 'ar' && !pathname.startsWith('/admin');

  useEffect(() => {
    const root = document.getElementById('root') || document.body;
    if (!active) {
      restore(root);
      return undefined;
    }
    if (!cache.size) loadStore();
    let scheduled = false;
    const pending = new Set();
    const run = () => {
      scheduled = false;
      const nodes = [...pending];
      pending.clear();
      nodes.forEach(walk);
    };
    const schedule = (node) => {
      pending.add(node);
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(run);
      }
    };
    onArrive = () => schedule(root);
    walk(root);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') schedule(m.target);
        else if (m.type === 'attributes') schedule(m.target);
        else m.addedNodes.forEach(schedule);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // Dialogs and menus can be rendered outside #root.
    const bodyObserver = root === document.body ? null : new MutationObserver((mutations) => {
      for (const m of mutations) m.addedNodes.forEach((n) => n !== root && schedule(n));
    });
    bodyObserver?.observe(document.body, { childList: true });
    document.title && wanted(document.title) && request(document.title.trim());
    return () => {
      observer.disconnect();
      bodyObserver?.disconnect();
      onArrive = () => {};
    };
  }, [active]);

  // Keep the page title in Arabic too.
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      const t = document.title;
      if (t && wanted(t)) {
        const tr = cache.get(t.trim());
        if (tr) document.title = tr;
        else request(t.trim());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active, pathname]);

  return null;
}
