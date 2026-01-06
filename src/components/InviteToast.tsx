import { createPortal } from 'react-dom';
import { useEffect } from 'react';
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
  // Auto-dismiss after durationMs if an onClose handler is provided
  useEffect(() => {
    if (!onClose) return;
    const t = setTimeout(() => {
      try {
        onClose();
      } catch {
        /* ignore */
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

  return createPortal(content, document.body);
}
