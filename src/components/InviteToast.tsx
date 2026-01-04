import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Copy, Check, X } from 'lucide-react'

export default function InviteToast({ inviteLink, onClose }: { inviteLink: string, onClose: () => void }) {
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        let t: any
        if (copied) t = setTimeout(() => setCopied(false), 2500)
        return () => clearTimeout(t)
    }, [copied])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink || '')
            setCopied(true)
        } catch {
            // ignore
            setCopied(true)
        }
    }

    const content = (
        <div className="fixed bottom-4 right-4 z-[99999] pointer-events-none w-auto">
            <div className="pointer-events-auto">
                <div className="relative p-3 shadow-lg bg-white rounded-md border flex items-stretch gap-3 max-w-md">
                    <button aria-label="Cerrar" onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>

                    <div className="flex-1 pr-2">
                        <div className="font-semibold">Invitación enviada</div>
                        <div className="text-sm text-muted-foreground mt-1 mb-0">
                            <a href={inviteLink} target="_blank" rel="noopener noreferrer" className="text-primary underline block max-w-full break-words break-all whitespace-normal pr-2" title={inviteLink}>{inviteLink}</a>
                        </div>
                    </div>

                    <div className="flex flex-col justify-end ml-3">
                        <Button size="sm" onClick={handleCopy} className={`flex items-center gap-2 transition-transform ${copied ? 'animate-pulse scale-95' : 'hover:scale-105'}`} aria-live="polite">
                            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            {copied ? '¡Copiado!' : 'Copiar'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )

    return createPortal(content, document.body)
}
