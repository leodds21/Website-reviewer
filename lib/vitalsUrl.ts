// Speed metrics are grouped by route: a report id or an analyzed address
// (?url=) never goes along with them.
export function vitalsRoute(pathname: string): string {
  return pathname.replace(/\/report\/[^/]+/, "/report/[id]");
}

export function vitalsUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${vitalsRoute(parsed.pathname)}`;
}
