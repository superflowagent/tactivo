Deno functions workspace settings

This folder is configured to use the Deno extension for VS Code.

Steps to enable full diagnostics locally:

1. Install the Deno extension (recommendation already in `.vscode/extensions.json`).
2. Open the `supabase/functions` folder in the workspace and accept enabling Deno when the extension prompts (or set `deno.enable` to true in this folder's `.vscode/settings.json`).
3. After enabling Deno, the editor should recognize remote imports (e.g., `https://deno.land/std/...`) and the `Deno` global, clearing the false positive problems in the Problems panel.

If you'd rather not enable Deno, the project currently excludes `supabase/functions` from the root `tsconfig.json` to suppress those diagnostics.
