/** Public assets live below Vite's base, including on repository GitHub Pages. */
export function publicAssetUrl(path: string, base = import.meta.env?.BASE_URL ?? '/') {
  return `${base.endsWith('/') ? base : base + '/'}${path.replace(/^\/+/, '')}`;
}
