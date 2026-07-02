import { describe, expect, it } from 'vitest'
import { escapeHtml } from './escape.js'

describe('escapeHtml', () => {
  it('escapes the five significant HTML characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
    )
  })

  it('escapes & first so it does not double-escape produced entities', () => {
    expect(escapeHtml('a&b<c')).toBe('a&amp;b&lt;c')
  })

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('My App (prod)')).toBe('My App (prod)')
  })
})
