import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore
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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'pif_admin') return json({ error: 'Forbidden' }, 403)

    const { consolidated_sheet_id, prompt } = await req.json()
    if (!consolidated_sheet_id || !prompt) {
      return json({ error: 'consolidated_sheet_id and prompt are required' }, 400)
    }

    // Fetch current file path
    const { data: sheetRow } = await supabase
      .from('consolidated_sheets')
      .select('*')
      .eq('id', consolidated_sheet_id)
      .single()
    if (!sheetRow) return json({ error: 'Consolidated sheet not found' }, 404)

    // Download current master file
    const { data: fileData } = await supabase.storage
      .from('consolidated')
      .download(sheetRow.file_path)
    if (!fileData) return json({ error: 'File not found in storage' }, 404)

    const buffer = await fileData.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    // Serialize current structure for Claude context
    const structure = workbook.worksheets.map((ws: typeof ExcelJS.Worksheet) => ({
      sheet: ws.name,
      headers: (ws.getRow(1).values as unknown[]).slice(1),
      row_count: ws.rowCount,
    }))

    // Ask Claude for a diff
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: `You are a spreadsheet editor. Given the current sheet structure and the user's instruction, output ONLY a JSON object describing the changes:
{
  "cell_updates": [{ "sheet": "<name>", "row": <1-based>, "col": <1-based>, "value": "<value>" }],
  "column_renames": [{ "sheet": "<name>", "col": <1-based>, "new_name": "<name>" }],
  "sheet_renames": [{ "old_name": "<name>", "new_name": "<name>" }],
  "message": "<one sentence summary of what was done>"
}
Output only the JSON object. No markdown fences.`,
        messages: [
          {
            role: 'user',
            content: `Current sheets:\n${JSON.stringify(structure, null, 2)}\n\nInstruction: ${prompt}`,
          },
        ],
      }),
    })

    if (!anthropicResp.ok) {
      return json({ error: 'Claude API error' }, 502)
    }

    const aiData = await anthropicResp.json()
    const rawText = aiData.content?.[0]?.text ?? '{}'

    let diff: {
      cell_updates?: Array<{ sheet: string; row: number; col: number; value: string }>
      column_renames?: Array<{ sheet: string; col: number; new_name: string }>
      sheet_renames?: Array<{ old_name: string; new_name: string }>
      message?: string
    }
    try {
      const match = rawText.match(/\{[\s\S]*\}/)
      diff = match ? JSON.parse(match[0]) : {}
    } catch {
      diff = {}
    }

    // Apply diff to workbook
    for (const upd of diff.cell_updates ?? []) {
      const ws = workbook.getWorksheet(upd.sheet)
      if (ws) ws.getRow(upd.row).getCell(upd.col).value = upd.value
    }
    for (const rename of diff.column_renames ?? []) {
      const ws = workbook.getWorksheet(rename.sheet)
      if (ws) ws.getRow(1).getCell(rename.col).value = rename.new_name
    }
    for (const sRename of diff.sheet_renames ?? []) {
      const ws = workbook.getWorksheet(sRename.old_name)
      if (ws) ws.name = sRename.new_name
    }

    // Upload as new version
    const basePath = sheetRow.file_path.replace(/_master\.xlsx$/, '')
    const newPath = `${basePath}_v${Date.now()}_master.xlsx`
    const newBuffer = await workbook.xlsx.writeBuffer()
    await supabase.storage.from('consolidated').upload(newPath, newBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // Update file_path in DB
    await supabase
      .from('consolidated_sheets')
      .update({ file_path: newPath })
      .eq('id', consolidated_sheet_id)

    return json({ success: true, new_file_path: newPath, message: diff.message ?? 'Changes applied.' }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
