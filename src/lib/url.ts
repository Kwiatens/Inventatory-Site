export function url(path = '/') {
  if (/^(https?:|mailto:)/.test(path)) return path;
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}
export function isCurrent(path: string, href: string) {
  if (href.startsWith('https:')) return false;
  const target = url(href);
  return href === '/' ? path === target : path.startsWith(target);
}
