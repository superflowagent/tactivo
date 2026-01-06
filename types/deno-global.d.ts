declare module 'https://deno.land/std@0.178.0/http/server.ts' {
  export function serve(handler: (req: any) => any): void;
}

declare const Deno: any;

declare function atob(encoded: string): string;
