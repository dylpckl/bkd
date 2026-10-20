import { describe, expect, it } from 'vitest'
import { safeNext } from './auth'

describe('safeNext', () => {
  it('keeps same-origin paths', () => {
    expect(safeNext('/join/abc')).toBe('/join/abc')
    expect(safeNext('/c/1/settings?tab=x')).toBe('/c/1/settings?tab=x')
  })
  it('rejects anything that could leave the site', () => {
    for (const bad of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '/\t/evil.test',
      '/\n/evil.test',
      '/\r\n/evil.test',
      '\\/evil.test',
      'javascript:alert(1)',
      '',
      undefined,
      42,
    ]) {
      expect(safeNext(bad)).toBe('/clubs')
    }
  })
  it('keeps encoded characters inside the path', () => {
    expect(safeNext('/%09/evil.test')).toBe('/%09/evil.test')
  })
})
