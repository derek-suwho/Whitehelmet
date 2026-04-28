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

    const { template_id, template_version_id, submission_ids } = await req.json()
    if (!template_id || !template_version_id || !submission_ids?.length) {
      return json({ error: 'template_id, template_version_id, and submission_ids are required' }, 400)
    }

    // Fetch template version schema
    const { data: versionRow } = await supabase
      .from('template_versions')
      .select('schema_json')
      .eq('id', template_version_id)
      .single()
    const schemaJson = versionRow?.schema_json as { columns: Array<{ id: string; name: string }> }

    // Fetch submissions with their assignment type
    const { data: submissionRows, error: subError } = await supabase
      .from('submissions')
      .select('*, template_assignments!assignment_id(submission_type, org_id), organizations!org_id(name)')
      .in('id', submission_ids)
      .eq('status', 'locked')
    if (subError) throw subError

    const masterWorkbook = new ExcelJS.Workbook()
    const summarySheet = masterWorkbook.addWorksheet('Summary')
    summarySheet.addRow(['DevCo', 'Submission Type', 'Status'])

    let template_count = 0
    let freeform_count = 0

    for (const sub of submissionRows ?? []) {
      const orgName = (sub as any).organizations?.name ?? sub.org_id
      const submissionType = (sub as any).template_assignments?.submission_type ?? 'template'

      // Download submission file
      const { data: fileData } = await supabase.storage
        .from('submissions')
        .download(sub.file_path)
      if (!fileData) continue

      const buffer = await fileData.arrayBuffer()
      const subWorkbook = new ExcelJS.Workbook()
      await subWorkbook.xlsx.load(buffer)

      if (submissionType === 'freeform') {
        freeform_count++
        // Include raw sheet with note
        const sourceSheet = subWorkbook.worksheets[0]
        if (sourceSheet) {
          const destSheet = masterWorkbook.addWorksheet(`${orgName} (Freeform)`)
          destSheet.addRow(['⚠ Freeform submission — review and map columns manually or use AI fine-tuning'])
          destSheet.getRow(1).getCell(1).font = { italic: true, color: { argb: 'FF856404' } }
          sourceSheet.eachRow((row: typeof ExcelJS.Row, rowNumber: number) => {
            destSheet.addRow(row.values)
          })
        }
        summarySheet.addRow([orgName, 'Freeform', 'Freeform — manual review required'])
      } else {
        template_count++
        const sourceSheet = subWorkbook.worksheets[0]
        if (!sourceSheet) continue

        const devcoSheet = masterWorkbook.addWorksheet(orgName)

        // Map columns from schema
        if (schemaJson?.columns) {
          devcoSheet.addRow(schemaJson.columns.map((c) => c.name))
          sourceSheet.eachRow((row: typeof ExcelJS.Row, rowNumber: number) => {
            if (rowNumber === 1) return
            devcoSheet.addRow(row.values.slice(1, schemaJson.columns.length + 1))
          })
        }

        summarySheet.addRow([orgName, 'Template', 'Submitted'])
      }
    }

    // Upload master file
    const masterBuffer = await masterWorkbook.xlsx.writeBuffer()
    const masterPath = `consolidated/${template_id}/${Date.now()}_master.xlsx`
    await supabase.storage.from('consolidated').upload(masterPath, masterBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // Insert consolidated_sheets row
    const { data: sheetRow } = await supabase
      .from('consolidated_sheets')
      .insert({ template_id, file_path: masterPath, generated_by: user.id })
      .select()
      .single()

    return json({
      consolidated_sheet_id: sheetRow?.id,
      file_path: masterPath,
      freeform_count,
      template_count,
    }, 200)
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
