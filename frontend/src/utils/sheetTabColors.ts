import JSZip from 'jszip'

const THEME_SLOTS = ['dk1','lt1','dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink']

async function loadThemePalette(zip: JSZip): Promise<string[]> {
  const xml = await zip.file('xl/theme/theme1.xml')?.async('text') ?? ''
  return THEME_SLOTS.map(slot => {
    const m = xml.match(new RegExp(`<a:${slot}[^>]*>.*?<a:srgbClr val="([0-9A-Fa-f]{6})"`, 's'))
              ?? xml.match(new RegExp(`<a:${slot}[^>]*>.*?lastClr="([0-9A-Fa-f]{6})"`, 's'))
    return m ? m[1].toUpperCase() : '808080'
  })
}

function applyTint(hex: string, tint: number): string {
  let r = parseInt(hex.slice(0, 2), 16)
  let g = parseInt(hex.slice(2, 4), 16)
  let b = parseInt(hex.slice(4, 6), 16)
  // Convert to HLS, apply tint to luminance, convert back
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  let h = 0, s = 0
  let l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
  }
  l = tint > 0 ? l + (1 - l) * tint : l * (1 + tint)
  l = Math.min(1, Math.max(0, l))
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  if (s === 0) { r = g = b = Math.round(l * 255) }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = Math.round(hue2rgb(p, q, h + 1/3) * 255)
    g = Math.round(hue2rgb(p, q, h) * 255)
    b = Math.round(hue2rgb(p, q, h - 1/3) * 255)
  }
  return r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0')
}

function resolveZipPath(target: string): string {
  // targets may be absolute (/xl/worksheets/sheet1.xml) or relative (worksheets/sheet1.xml)
  const clean = target.startsWith('/') ? target.slice(1) : target
  return clean.startsWith('xl/') ? clean : `xl/${clean}`
}

/**
 * Extracts sheet tab colors from raw xlsx bytes.
 * Returns one entry per sheet in workbook order; null means no custom color.
 * Colors are returned as #RRGGBB hex strings.
 */
export async function extractSheetTabColorsFromXlsx(
  raw: ArrayBuffer,
): Promise<(string | null)[]> {
  const zip = await JSZip.loadAsync(raw)

  const wbXml = await zip.file('xl/workbook.xml')?.async('text') ?? ''
  const sheetMatches = [...wbXml.matchAll(/<sheet\b[^>]*\br:id="([^"]+)"[^>]*\/?>/g)]
  const rIds = sheetMatches.map(m => m[1])

  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('text') ?? ''
  const relMap: Record<string, string> = {}
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) {
    relMap[m[1]] = m[2]
  }

  let palette: string[] | null = null

  const colors: (string | null)[] = []
  for (const rId of rIds) {
    const target = relMap[rId]
    if (!target) { colors.push(null); continue }

    const sheetXml = await zip.file(resolveZipPath(target))?.async('text') ?? ''
    const tabMatch = sheetXml.match(/<tabColor\b([^/]*)\/>/s)
    if (!tabMatch) { colors.push(null); continue }

    const attrs = tabMatch[1]
    const rgbMatch = attrs.match(/\brgb="([0-9A-Fa-f]{8})"/)
    if (rgbMatch) {
      colors.push('#' + rgbMatch[1].slice(2).toUpperCase())
      continue
    }

    const themeMatch = attrs.match(/\btheme="(\d+)"/)
    if (themeMatch) {
      if (!palette) palette = await loadThemePalette(zip)
      const baseHex = palette[parseInt(themeMatch[1])] ?? '808080'
      const tintMatch = attrs.match(/\btint="([^"]+)"/)
      const tint = tintMatch ? parseFloat(tintMatch[1]) : 0
      const hex = tint !== 0 ? applyTint(baseHex, tint) : baseHex
      colors.push('#' + hex.toUpperCase())
      continue
    }

    colors.push(null)
  }

  return colors
}

/**
 * Returns '#000000' or '#ffffff' — whichever contrasts better with the given
 * background hex color (#RRGGBB).
 */
export function pickContrastText(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b)
  return L > 0.179 ? '#000000' : '#ffffff'
}
