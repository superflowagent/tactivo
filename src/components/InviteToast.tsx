import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'

export default function InviteToast({ onClose }: { onClose: () => void }) {

    const content = (
        <div className="fixed bottom-4 right-4 z-[99999] pointer-events-none w-auto">
            <div className="pointer-events-auto">
                <Alert variant="success" className="shadow-lg rounded-md max-w-md relative px-4 py-3">
                    <button aria-label="Cerrar" onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <AlertTitle className="m-0">Invitación enviada</AlertTitle>
                        </div>
                    </div>
                </Alert>
            </div>
        </div>
    )

    return createPortal(content, document.body)
}
