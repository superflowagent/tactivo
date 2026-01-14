import React, { Suspense, lazy } from 'react';

const Editor = lazy(async () => ({ default: (await import('./rich-text-editor')).RichTextEditor }));

export interface LazyRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export default function LazyRichTextEditor(props: LazyRichTextEditorProps) {
  return (
    <Suspense fallback={<div className="p-2 text-sm">Cargando editor…</div>}>
      <Editor {...props} />
    </Suspense>
  );
}
