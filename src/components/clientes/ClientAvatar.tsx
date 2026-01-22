import React, { useState } from 'react';
import useResolvedFileUrl from '@/hooks/useResolvedFileUrl';
import type { Cliente } from '@/types/cliente';

export default function ClientAvatar({ cliente }: { cliente: Cliente }) {
  const filename = cliente.photo_path || cliente.photo || null;
  const resolvedUrl = useResolvedFileUrl('profile_photos', cliente.id || null, filename);
  const [broken, setBroken] = useState(false);

  if (resolvedUrl && !broken) {
    return (
      <img
        src={resolvedUrl}
        alt={cliente.name || ''}
        className="w-10 h-10 rounded-md object-cover"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-sm font-medium">
      {String(cliente.name || '')?.charAt(0)}
      {String(cliente.last_name || '')?.charAt(0)}
    </div>
  );
}
