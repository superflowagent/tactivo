import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import ProjectAlert from '@/components/ui/project-alert'

export default function InviteToast({ onClose }: { onClose: () => void }) {

    const content = (
        <div className="fixed bottom-4 right-4 z-[99999] pointer-events-none w-auto">
            <div className="pointer-events-auto">
                <div className="shadow-lg rounded-md max-w-md relative px-4 py-3">
                    <ProjectAlert variant="success" title={<span>Invitación enviada</span>} />
                </div>
            </div>
        </div>
    )

    return createPortal(content, document.body)
}
