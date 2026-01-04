import { createPortal } from 'react-dom'
import ProjectAlert from '@/components/ui/project-alert'

export default function InviteToast() {

    const content = (
        <div className="fixed bottom-4 right-4 z-[99999] pointer-events-none w-auto">
            <div className="pointer-events-auto">
                <ProjectAlert variant="success" title={<span>Invitación enviada</span>} className="max-w-md" />
            </div>
        </div>
    )

    return createPortal(content, document.body)
}
