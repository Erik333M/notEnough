/**
 * Links that open the app.
 *
 * One shape so far: `notenough://friend/7KDP2M`, which someone sends through
 * whatever messaging app they already use. Parsing lives here rather than in
 * the shell so the rules can be read — and tested — without a device.
 *
 * A link never *acts*. It fills the code box and leaves the tap to the
 * person: adding a friend because a URL was opened would be a decision made
 * by whoever sent the URL, which is not the same thing as consent.
 */
export type DeepLink = { kind: 'friend'; code: string };

/** Same alphabet the codes are minted from — no O/0 or I/1. */
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export function parseDeepLink(url: string | null | undefined): DeepLink | null {
  if (!url) return null;

  // Accepts notenough://friend/CODE and https://…/friend/CODE alike, so a
  // universal link later needs no second parser.
  const match = url.match(/friend\/([^/?#]+)/i);
  if (!match) return null;

  const code = decodeURIComponent(match[1]).trim().toUpperCase();
  return CODE.test(code) ? { kind: 'friend', code } : null;
}

export function friendLink(code: string): string {
  return `notenough://friend/${code}`;
}
