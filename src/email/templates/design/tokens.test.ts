import { describe, expect, it } from 'vitest'
import { chip, dot, FONT_SANS, SEV, severityFor } from './tokens.js'

describe('design tokens', () => {
  it('maps counts to overall severity', () => {
    expect(severityFor(2, 0)).toBe('danger') // expired present
    expect(severityFor(0, 3)).toBe('warn') // only expiring
    expect(severityFor(0, 0)).toBe('ok') // clear
  })

  it('exposes the three severity colors', () => {
    expect(SEV.danger.color).toBe('#DC2626')
    expect(SEV.warn.color).toBe('#D97706')
    expect(SEV.ok.color).toBe('#16A34A')
  })

  it('renders a colored glyph dot (Outlook-safe, not border-radius)', () => {
    const d = dot('danger')
    expect(d).toContain('●')
    expect(d).toContain('#DC2626')
    expect(d).not.toContain('border-radius')
  })

  it('renders a mono uppercase chip with tint + count', () => {
    const c = chip('17', 'warn')
    expect(c).toContain('17')
    expect(c).toContain('#FFFBEB') // warn tint
  })

  it('keeps a web-safe Outlook fallback in the sans stack', () => {
    expect(FONT_SANS.toLowerCase()).toContain('arial')
  })
})
