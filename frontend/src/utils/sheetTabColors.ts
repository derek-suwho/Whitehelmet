import JSZip from 'jszip'

/** Fallback when theme1.xml is missing or unparsable (Office default order). */
const DEFAULT_THEME_COLORS = [
  '#000000',
  '#FFFFFF',
  '#44546A',
  '#E7E6E6',
  '#5B9BD5',
  '#ED7D31',
  '#A5A5A5',
  '#FFC000',
  '#4472C4',
  '#70AD47',
  '#0563C1',
  '#954F72',
]

function decodeXmlAttr(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseThemeColors(themeXml: string): string[] {
  const schemeMatch = themeXml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/i)
  if (!schemeMatch) return [...DEFAULT_THEME_COLORS]
  const body = schemeMatch[1]
  const colors: string[] = []
  const childRegex = /<a:(\w+)>([\s\S]*?)<\/a:\1>/gi
  let m: RegExpExecArray | null
  while ((m = childRegex.exec(body)) !== null) {
    const inner = m[2]
    const srgb = /<a:srgbClr[^>]*val="([0-9A-Fa-f]{6})"/i.exec(inner)
    const sys = /<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/i.exec(inner)
    if (srgb) colors.push('#' + srgb[1].toUpperCase())
    else if (sys) colors.push('#' + sys[1].toUpperCase())
    else colors.push('#A6A6A6')
  }
  return colors.length ? colors : [...DEFAULT_THEME_COLORS]
}

function argbToCss(argb: string): string {
  const s = argb.replace(/^#/, '')
  const hex = s.length >= 8 ? s.slice(2) : s
  return '#' + hex.slice(-6).toUpperCase()
}

function parseTabColorTag(tag: string, themeColors: string[]): string | null {
  const rgb = /\brgb="([0-9A-Fa-f]+)"/i.exec(tag)?.[1]
  if (rgb) return argbToCss(rgb)
  const themeStr = /\btheme="(\d+)"/i.exec(tag)?.[1]
  if (themeStr != null) {
    const idx = parseInt(themeStr, 10)
    const base = themeColors[idx]
    if (base) return base
  }
  return null
}

function parseWorksheetTabColor(wsXml: string, themeColors: string[]): string | null {
  const sheetPrMatch = wsXml.match(/<sheetPr\b[^>]*>([\s\S]*?)<\/sheetPr>/i)
  const block = sheetPrMatch ? sheetPrMatch[1] : wsXml.slice(0, 8000)
  const tabMatch = block.match(/<tabColor\b[^>]*\/?>/i)
  if (!tabMatch) return null
  return parseTabColorTag(tabMatch[0], themeColors)
}

/** Readable text on a solid #RRGGBB background (Excel-style tabs). */
export function pickContrastText(bgHex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(bgHex.trim())
  if (!m) return '#1a1a1a'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 186 ? '#1a1a1a' : '#ffffff'
}

/**
 * Read per-sheet tab colors from an .xlsx (OOXML) file.
 * Order matches workbook.xml / SheetJS SheetNames. Non-zip formats are not supported.
 */
export async function extractSheetTabColorsFromXlsx(data: ArrayBuffer): Promise<(string | null)[]> {
  const zip = await JSZip.loadAsync(data)
  const wbStr = await zip.file('xl/workbook.xml')?.async('string')
  if (!wbStr) return []

  const relsStr = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  const ridToTarget = new Map<string, string>()
  if (relsStr) {
    for (const m of relsStr.matchAll(/<Relationship\b[^>]*>/gi)) {
      const tag = m[0]
      const id = /\bId="([^"]+)"/i.exec(tag)?.[1]
      const target = /\bTarget="([^"]+)"/i.exec(tag)?.[1]
      if (id && target) {
        let t = target.replace(/^\//, '').replace(/^\.\//, '')
        if (!t.startsWith('xl/')) t = 'xl/' + t
        ridToTarget.set(id, t)
      }
    }
  }

  let themeColors = [...DEFAULT_THEME_COLORS]
  const themeFile = zip.file('xl/theme/theme1.xml')
  if (themeFile) {
    try {
      const themeXml = await themeFile.async('string')
      themeColors = parseThemeColors(themeXml)
    } catch {
      /* keep default */
    }
  }

  const sheets: { rid: string }[] = []
  for (const m of wbStr.matchAll(/<sheet\b[^>]*\/?>/gi)) {
    const tag = m[0]
    const rid = /\br:id="([^"]+)"/i.exec(tag)?.[1]
    if (rid) sheets.push({ rid })
  }

  const colors: (string | null)[] = []
  for (const s of sheets) {
    const path = ridToTarget.get(s.rid)
    if (!path) {
      colors.push(null)
      continue
    }
    const wsFile = zip.file(path)
    if (!wsFile) {
      colors.push(null)
      continue
    }
    const wsXml = await wsFile.async('string')
    colors.push(parseWorksheetTabColor(wsXml, themeColors))
  }

  return colors
}
