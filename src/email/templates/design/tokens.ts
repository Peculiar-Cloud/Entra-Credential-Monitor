/**
 * Design vocabulary for the report email: palette, fonts, and the small style
 * fragments (severity dot, count chip) shared across the renderer.
 *
 * Minimalist-light direction (Vercel/Linear lineage): white card on a soft
 * canvas, near-black text, a restrained gray ramp, and severity color only as
 * a *mark* (dots, chips, the severity stat numbers), never as decoration.
 */

export type Severity = 'danger' | 'warn' | 'ok'

/** Severity ink + `-50` tint + tint border, plus the header pill label. */
export const SEV: Record<Severity, { color: string; tint: string; border: string; label: string }> =
  {
    danger: { color: '#DC2626', tint: '#FEF2F2', border: '#FBD5D5', label: 'Action required' },
    warn: { color: '#D97706', tint: '#FFFBEB', border: '#FCE7B5', label: 'Review soon' },
    ok: { color: '#16A34A', tint: '#F0FDF4', border: '#BBF7D0', label: 'All clear' },
  }

/** Neutral surface/text ramp. */
export const COLOR = {
  page: '#FAFAFA',
  card: '#FFFFFF',
  raised: '#FAFAFA',
  border: '#EAEAEA',
  borderSoft: '#F2F2F2',
  text: '#171717',
  text2: '#666666',
  text3: '#999999',
  link: '#0070F3',
} as const

// Single quotes inside the family names are mandatory: these strings are
// interpolated into double-quoted style="" attributes, so double quotes would
// close the attribute early. The stacks end in web-safe families so Outlook
// (which ignores the Geist @import) still renders a clean fallback.
export const FONT_SANS =
  "'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
export const FONT_MONO =
  "'Geist Mono','SF Mono',ui-monospace,'Cascadia Mono',Menlo,Consolas,monospace"

/** Overall report severity from the expired/expiring counts. */
export function severityFor(expired: number, expiring: number): Severity {
  if (expired > 0) return 'danger'
  if (expiring > 0) return 'warn'
  return 'ok'
}

/**
 * Status marker. A colored Unicode glyph rather than a `border-radius` circle
 * so Outlook/Windows (which drops border-radius) still shows a round dot.
 */
export function dot(sev: Severity): string {
  return `<span style="color:${SEV[sev].color};font-size:11px;line-height:1;">●</span>`
}

/** Mono uppercase count chip, tinted by severity. */
export function chip(text: string, sev: Severity): string {
  const s = SEV[sev]
  return `<span style="font-family:${FONT_MONO};font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;color:${s.color};background:${s.tint};border:1px solid ${s.border};border-radius:4px;padding:2px 7px;">${text}</span>`
}
