// Edge Function retired: removal marker
// This function was removed in favor of direct client uploads to Storage with RLS policies.
// Kept as a 410 to make any accidental calls explicit.
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';

serve(() => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token'
  };
  return new Response(JSON.stringify({ error: 'function_removed', message: 'upload-exercise-video has been retired; upload directly to storage' }), {
    status: 410,
    headers
  });
});
