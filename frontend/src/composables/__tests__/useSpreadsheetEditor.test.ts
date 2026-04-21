import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('handsontable', () => ({
  default: { renderers: { registerRenderer: vi.fn(), getRenderer: vi.fn(() => vi.fn()) } }
}))

// Import helpers directly — they are exported for testing
import { argbToCssTest, colLetterTest, getFmtTest, setFmtTest, resetFormatsTest } from '../useSpreadsheetEditor'

describe('argbToCss', () => {
  it('converts 8-char ARGB to CSS hex', () => {
    expect(argbToCssTest('FF112233')).toBe('#112233')
  })
  it('passes through 6-char hex', () => {
    expect(argbToCssTest('112233')).toBe('#112233')
  })
  it('returns null for falsy', () => {
    expect(argbToCssTest('')).toBeNull()
  })
})

describe('colLetter', () => {
  it('converts index 0 to A', () => expect(colLetterTest(0)).toBe('A'))
  it('converts index 25 to Z', () => expect(colLetterTest(25)).toBe('Z'))
  it('converts index 26 to AA', () => expect(colLetterTest(26)).toBe('AA'))
})

describe('getFmt / setFmt', () => {
  beforeEach(() => resetFormatsTest())

  it('returns empty object for unknown cell', () => {
    expect(getFmtTest(0, 0, 0)).toEqual({})
  })
  it('sets and gets a format property', () => {
    setFmtTest(0, 1, 2, { bold: true })
    expect(getFmtTest(0, 1, 2)).toMatchObject({ bold: true })
  })
  it('merges format properties', () => {
    setFmtTest(0, 0, 0, { bold: true })
    setFmtTest(0, 0, 0, { italic: true })
    expect(getFmtTest(0, 0, 0)).toMatchObject({ bold: true, italic: true })
  })
})
