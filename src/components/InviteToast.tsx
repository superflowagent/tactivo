import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import ProjectAlert from '@/components/ui/project-alert';

export default function InviteToast({
  title = 'Invitación enviada',
  durationMs = 4000,
  onClose,
}: {
  title?: React.ReactNode;
  durationMs?: number;
  onClose?: () => void;
}) {
  // Internal visibility so the toast auto-dismisses even if onClose isn't provided
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (onClose) onClose();
      } finally {
        setVisible(false);
      }
    }, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  const content = (
    <div className="fixed bottom-4 right-4 z-[99999] pointer-events-none w-auto">
      <div className="pointer-events-auto">
        <ProjectAlert variant="success" title={<span>{title}</span>} className="max-w-md" />
      </div>
    </div>
  );

  return visible ? createPortal(content, document.body) : null;
}
