// Edge function: test-fn
// Replace with your implementation
import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';

serve((req) => {
  return new Response(JSON.stringify({ ok: true, function: 'test-fn' }), {
    headers: { 'content-type': 'application/json' },
  });
});
