/**
 * The slice of RFC 6570 the app's URL templates need: `{var}` (percent-encodes
 * reserved characters) and `{+var}` (keeps them). Unknown variables expand to
 * nothing.
 */
export function fillUriTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{(\+?)([A-Za-z0-9_]+)\}/g, (_match, plus: string, name: string) => {
    const value = vars[name];
    if (value === undefined) return '';
    return plus ? encodeURI(value) : encodeURIComponent(value);
  });
}

/** Fill a template with the parts of a URL. */
export function templateUrl(template: string, url: string | URL): string {
  const u = new URL(url);

  return fillUriTemplate(template, {
    url: u.href,
    href: u.href,
    origin: u.origin,
    protocol: u.protocol,
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    hash: u.hash,
    search: u.search,
  });
}

/**
 * A well-formed https URL, or `undefined`.
 *
 * Anything reaching an `href` or `src` from event data or a third-party API
 * has to come through here: a `javascript:` URL in either place executes with
 * this app's origin, where the user's nsec is stored.
 *
 * `base` resolves relative URLs — link preview endpoints return them (an
 * `og:image` of `/cover.png`), and they mean nothing without the page's own
 * origin to resolve against.
 */
export function sanitizeUrl(raw: string | undefined | null, base?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw, base);
    return parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
