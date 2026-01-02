import { serve } from 'https://deno.land/std@0.178.0/http/server.ts'

serve(async (req) => {
  const origin = req.headers.get('origin') || '*'
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token',
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  return new Response(JSON.stringify({ ok: true, fn: 'send-invite-test' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
})