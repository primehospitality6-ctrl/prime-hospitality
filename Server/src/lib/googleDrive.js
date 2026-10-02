/**
 * Google Drive helpers for unit galleries (folder links → image URLs).
 * Prefer GOOGLE_DRIVE_API_KEY for reliable listing of public folders.
 */

const IMAGE_NAME = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i;
const NON_IMAGE_NAME = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|mp4|mov|avi|mkv|webm)$/i;

function isImageFile({ mimeType, name }) {
  const n = String(name || '').trim();
  if (NON_IMAGE_NAME.test(n)) return false;
  if (mimeType) return /^image\//i.test(mimeType) || (/^application\/octet-stream/i.test(mimeType) && IMAGE_NAME.test(n));
  return true;
}

function extractFolderId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw) && !raw.includes('/')) return raw;

  const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  const openMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  return null;
}

function extractFileId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const fileMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const openMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;
  return null;
}

/**
 * URL that works in <img> for publicly shared Drive files. drive.google.com/uc links return the original
 * file as application/octet-stream, which browsers refuse to render as an image.
 */
function toImageUrl(fileId, size = 2000) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
}

function toThumbnailUrl(fileId, size = 800) {
  return toImageUrl(fileId, size);
}

const DRIVE_FILE_LINK = /^https?:\/\/(?:drive|docs)\.google\.com\/(?:uc|open|thumbnail|file\/d\/)/i;

/** Rewrite a Drive file link (uc / open / thumbnail / file/d) to its image URL; anything else is returned unchanged. */
function normalizeImageUrl(url) {
  if (typeof url !== 'string' || !DRIVE_FILE_LINK.test(url)) return url;
  const fileId = extractFileId(url);
  return fileId ? toImageUrl(fileId) : url;
}

/** Deep copy of `value` with every Drive file link rewritten. */
function normalizeImageUrls(value) {
  if (typeof value === 'string') return normalizeImageUrl(value);
  if (Array.isArray(value)) return value.map(normalizeImageUrls);
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeImageUrls(v);
    return out;
  }
  return value;
}

function getApiKey() {
  return String(process.env.GOOGLE_DRIVE_API_KEY || '').trim() || null;
}

async function listViaApi(folderId) {
  const key = getApiKey();
  if (!key) return null;

  const q = `'${folderId}' in parents and trashed = false`;
  const fields = 'files(id,name,mimeType)';
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', fields);
  url.searchParams.set('pageSize', '200');
  url.searchParams.set('orderBy', 'name');
  url.searchParams.set('key', key);
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || res.statusText || 'Drive API error';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return (Array.isArray(data.files) ? data.files : []).map((f) => ({
    id: f.id,
    name: f.name || '',
    mimeType: f.mimeType || 'application/octet-stream',
  }));
}

/** Best-effort parse of Drive's embedded folder view (public folders, no API key). */
async function listViaEmbeddedView(folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
  });
  if (!res.ok) {
    const err = new Error(`Could not open Drive folder (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const html = await res.text();

  const entries = [...html.matchAll(/id="entry-([a-zA-Z0-9_-]{20,})"[\s\S]*?class="flip-entry-title">([^<]*)</g)].map(
    (m) => ({ id: m[1], name: m[2].trim() })
  );
  if (entries.length) return entries.filter((e) => e.id !== folderId);

  const ids = [];
  const seen = new Set();

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/g,
    /thumbnail\?id=([a-zA-Z0-9_-]{20,})/g,
    /\["([a-zA-Z0-9_-]{25,})",\d+,\["image\//g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      if (id === folderId || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids.map((id) => ({ id, name: '' }));
}

/**
 * List image files from a shared Google Drive folder URL or ID.
 * Folder must be shared as “Anyone with the link”.
 */
async function listFolderImages(folderUrlOrId) {
  const folderId = extractFolderId(folderUrlOrId);
  if (!folderId) {
    const err = new Error('Invalid Google Drive folder link');
    err.status = 400;
    throw err;
  }

  let files = null;
  let method = 'api';

  try {
    files = await listViaApi(folderId);
  } catch (err) {
    if (getApiKey()) {
      err.message = `Drive API: ${err.message}. Make sure the folder is shared as “Anyone with the link”.`;
      throw err;
    }
  }

  if (!files) {
    method = 'embedded';
    files = await listViaEmbeddedView(folderId);
  }

  const images = files.filter(isImageFile).map((f, i) => ({
    id: f.id,
    name: f.name || `Photo ${i + 1}`,
    url: toImageUrl(f.id),
    thumbnail: toThumbnailUrl(f.id),
  }));

  if (!images.length) {
    const err = new Error(
      files.length
        ? `That folder has ${files.length} file${files.length === 1 ? '' : 's'} but no photos (for example PDFs or documents). Use the folder that holds the unit's photos.`
        : getApiKey()
          ? 'No images found in that folder. Share it as “Anyone with the link” and ensure it contains image files.'
          : 'No images found. Share the folder as “Anyone with the link”, or set GOOGLE_DRIVE_API_KEY in Server/.env for reliable listing.'
    );
    err.status = 404;
    throw err;
  }

  return {
    folderId,
    method,
    images,
    urls: images.map((i) => i.url),
  };
}

module.exports = {
  extractFolderId,
  extractFileId,
  toImageUrl,
  normalizeImageUrl,
  normalizeImageUrls,
  listFolderImages,
};
