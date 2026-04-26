import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a KPI template designer. The user will describe a reporting template and you must output a valid JSON object with this exact structure:
{
  "columns": [
    {
      "id": "<uuid>",
      "name": "<column name>",
      "type": "<text|number|date|percentage>",
      "description": "<brief description>",
      "validation": { "required": true/false }
    }
  ]
}
Output only the JSON object. No explanation, no markdown fences.`

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

    const { prompt, existing_schema } = await req.json()
    if (!prompt) return json({ error: 'prompt is required' }, 400)

    const userMessage = existing_schema
      ? `${prompt}\n\nExisting schema for reference:\n${JSON.stringify(existing_schema, null, 2)}`
      : prompt

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
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!anthropicResp.ok) {
      const err = await anthropicResp.text()
      return json({ error: `Claude API error: ${err}` }, 502)
    }

    const aiData = await anthropicResp.json()
    const rawText = aiData.content?.[0]?.text ?? ''

    let schema_json: object
    try {
      schema_json = JSON.parse(rawText)
    } catch {
      // Try to extract JSON from the response if it includes extra text
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) return json({ error: 'Claude did not return valid JSON' }, 502)
      schema_json = JSON.parse(match[0])
    }

    return json({ schema_json }, 200)
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
