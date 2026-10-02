const DEFAULT_WIDTHS = [480, 768, 1080, 1440, 1920];

function isUnsplash(url) {
  return /^https:\/\/images\.unsplash\.com\//.test(url);
}

function isCloudinary(url) {
  return /^https:\/\/res\.cloudinary\.com\/.+\/upload\//.test(url);
}

function isDriveImage(url) {
  return /^https:\/\/lh3\.googleusercontent\.com\/d\/[\w-]+(=w\d+)?$/.test(url);
}

export function canResize(url) {
  return typeof url === 'string' && (isUnsplash(url) || isCloudinary(url) || isDriveImage(url));
}

/** Same image at a given pixel width, re-encoded by the CDN (AVIF/WebP where supported). */
export function sizedSrc(url, width) {
  if (!canResize(url)) return url;
  if (isUnsplash(url)) {
    const u = new URL(url);
    u.searchParams.set('w', String(width));
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', u.searchParams.get('fit') || 'crop');
    u.searchParams.set('q', '72');
    return u.toString();
  }
  if (isDriveImage(url)) return `${url.replace(/=w\d+$/, '')}=w${width}`;
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export function srcSetFor(url, widths = DEFAULT_WIDTHS) {
  if (!canResize(url)) return undefined;
  return widths.map((w) => `${sizedSrc(url, w)} ${w}w`).join(', ');
}
