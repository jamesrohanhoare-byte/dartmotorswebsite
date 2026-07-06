// Resize + compress remote (VMG S3) images on the fly through the free weserv
// image CDN. Keeps JPEG format so saved images stay ad-friendly — just sized to
// the display and recompressed (e.g. a 250KB S3 photo → ~50KB at grid size).
// Local/relative paths pass through untouched. Full-res originals are still used
// where quality matters (e.g. the fullscreen lightbox), so nothing is lost there.
export function cdnImg(src: string | undefined | null, width: number, quality = 80): string {
  if (!src) return "";
  if (!/^https?:\/\//i.test(src)) return src; // local asset — leave as-is
  const path = src.replace(/^https?:\/\//i, "");
  const prefix = /^https:/i.test(src) ? "ssl:" : "";
  return `https://images.weserv.nl/?url=${prefix}${encodeURI(path)}&w=${width}&q=${quality}`;
}
