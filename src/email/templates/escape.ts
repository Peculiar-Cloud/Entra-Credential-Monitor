/**
 * Escape a string for safe interpolation into an HTML context.
 *
 * Entra-derived values rendered into report emails (application and owner
 * display names, organization names, certificate thumbprints, self-monitoring
 * messages) are attacker-influenceable: anyone who can register an app or set
 * their own display name in a monitored tenant controls that text. Escaping at
 * the template boundary keeps a planted payload from rendering as live markup
 * in an admin's mail client.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
