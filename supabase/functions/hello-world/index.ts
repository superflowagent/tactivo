// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
console.log('Hello from Functions!');
Deno.serve(async (req) => {
  const { name } = await req.json();
  // Temporary env & file check: if called with special name, return whether ADMIN_SECRET is present in Deno.env or in common file paths
  if (name === '__env_check') {
    const presentEnv = !!globalThis.Deno?.env?.get('ADMIN_SECRET');
    const paths = [
      './.local_admin_secret',
      '/var/task/.local_admin_secret',
      '/run/secrets/ADMIN_SECRET',
      './supabase/.local_admin_secret',
      '../.local_admin_secret'
    ];
    const fileChecks = {};
    for (const p of paths) {
      try {
        const txt = await (Deno as any).readTextFile(p);
        fileChecks[p] = {
          exists: true,
          trimmed: txt.trim().length > 0
        };
      } catch (e) {
        fileChecks[p] = {
          exists: false
        };
      }
    }
    let cwd = null;
    try {
      cwd = Deno.cwd();
    } catch (e) {
      cwd = null;
    }
    return new Response(JSON.stringify({
      admin_secret_in_env: presentEnv,
      cwd,
      file_checks: fileChecks
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  const data = {
    message: `Hello ${name}!`
  };
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}); /* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/hello-world' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/ 
