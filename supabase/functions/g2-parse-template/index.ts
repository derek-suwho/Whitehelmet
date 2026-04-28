import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore — exceljs Deno import
import ExcelJS from 'npm:exceljs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify pif_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'pif_admin') return json({ error: 'Forbidden' }, 403)

    const { file_path } = await req.json()
    if (!file_path) return json({ error: 'file_path is required' }, 400)

    // Download from storage
    const { data: fileData, error: storageError } = await supabase.storage
      .from('templates')
      .download(file_path)
    if (storageError || !fileData) return json({ error: 'File not found' }, 404)

    // Parse with exceljs
    const buffer = await fileData.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheets = workbook.worksheets.map((sheet: typeof ExcelJS.Worksheet) => {
      const headerRow = sheet.getRow(1).values as (string | undefined)[]
      // headerRow[0] is undefined (1-indexed)
      const headers = headerRow.slice(1).filter(Boolean) as string[]

      const sampleRows: string[][] = []
      for (let r = 2; r <= Math.min(sheet.rowCount, 11); r++) {
        const row = sheet.getRow(r).values as unknown[]
        sampleRows.push(row.slice(1, headers.length + 1).map(String))
      }

      const columns = headers.map((name, idx) => {
        const samples = sampleRows.map((r) => r[idx] ?? '').filter(Boolean)
        const inferred_type = inferType(samples)
        return { name, inferred_type, sample_values: samples.slice(0, 3) }
      })

      return { name: sheet.name, columns }
    })

    return json({ sheets }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function inferType(samples: string[]): 'text' | 'number' | 'date' | 'percentage' {
  if (!samples.length) return 'text'
  const pctMatch = samples.every((s) => /^\d+(\.\d+)?%$/.test(s))
  if (pctMatch) return 'percentage'
  const numMatch = samples.every((s) => !isNaN(Number(s)) && s !== '')
  if (numMatch) return 'number'
  const dateMatch = samples.every((s) => !isNaN(Date.parse(s)))
  if (dateMatch) return 'date'
  return 'text'
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
