import React, { useEffect, useState } from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getProfilePhone } from '@/lib/profiles';

interface WhatsAppLinkProps {
    profileId?: string; // profile.id or profile.user
    phone?: string; // raw phone string (will be digits-normalized)
    message?: string;
    className?: string;
    size?: number; // px
    ariaLabel?: string;
    tooltipText?: string;
    showPlaceholder?: boolean; // show icon even if phone missing (disabled)
}

export function WhatsAppLink({
    profileId,
    phone,
    message,
    className = '',
    size = 16,
    ariaLabel,
    tooltipText = 'Enviar WhatsApp',
    showPlaceholder = false,
}: WhatsAppLinkProps) {
    const [resolved, setResolved] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // If caller provides phone directly, prefer it (normalize digits-only)
    useEffect(() => {
        if (phone) {
            const digits = String(phone).replace(/\D/g, '');
            setResolved(digits || null);
            return;
        }

        if (!profileId) {
            setResolved(null);
            return;
        }

        let mounted = true;
        setLoading(true);
        getProfilePhone(profileId)
            .then((p) => {
                if (!mounted) return;
                setResolved(p);
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [profileId, phone]);

    const hasPhone = Boolean(resolved);
    const text = message ?? '';
    const url = hasPhone ? `https://wa.me/${resolved}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '#';

    // Show placeholder while loading if requested
    const showDisabled = !hasPhone && (showPlaceholder || loading);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    {hasPhone ? (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`${className} inline-flex items-center`}
                            aria-label={ariaLabel ?? tooltipText}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 32 32"
                                width={size}
                                height={size}
                                className="block"
                                aria-hidden
                            >
                                <path fill="#25D366" d="M16 3C9.37 3 4 8.37 4 15c0 2.64.86 5.08 2.32 7.03L4 29l7.26-2.27A11.9 11.9 0 0016 27c6.63 0 12-5.37 12-12S22.63 3 16 3z" />
                                <path fill="#FFF" d="M22.2 19.2c-.4-.2-2.3-1.1-2.6-1.2-.4-.1-.6-.2-.9.2-.3.4-1.1 1.2-1.3 1.4-.2.2-.4.3-.8.1-2.1-.9-3.5-3.6-3.7-3.9-.2-.3 0-.5.2-.7.2-.2.4-.4.6-.6.2-.2.3-.3.5-.5.1-.1.1-.3 0-.5-.1-.2-.9-2.1-1.3-2.9-.3-.7-.7-.5-.9-.5-.2 0-.5 0-.8 0-.3 0-.7.1-1 .4-.3.2-1 1-1 2.6 0 1.7 1 3.3 1.1 3.5.1.3 1.9 3 4.6 4.2 3 .9 3.3.8 3.9.7.6-.1 2-1 2.3-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.7-.5z" />
                            </svg>
                        </a>
                    ) : (
                        showDisabled ? (
                            <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className={`${className} inline-flex items-center opacity-60 cursor-not-allowed`}
                                aria-label={ariaLabel ?? (loading ? 'Cargando teléfono' : 'Sin teléfono')}
                                aria-disabled
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 32 32"
                                    width={size}
                                    height={size}
                                    className="block"
                                    aria-hidden
                                >
                                    <path fill="#25D366" d="M16 3C9.37 3 4 8.37 4 15c0 2.64.86 5.08 2.32 7.03L4 29l7.26-2.27A11.9 11.9 0 0016 27c6.63 0 12-5.37 12-12S22.63 3 16 3z" />
                                    <path fill="#FFF" d="M22.2 19.2c-.4-.2-2.3-1.1-2.6-1.2-.4-.1-.6-.2-.9.2-.3.4-1.1 1.2-1.3 1.4-.2.2-.4.3-.8.1-2.1-.9-3.5-3.6-3.7-3.9-.2-.3 0-.5.2-.7.2-.2.4-.4.6-.6.2-.2.3-.3.5-.5.1-.1.1-.3 0-.5-.1-.2-.9-2.1-1.3-2.9-.3-.7-.7-.5-.9-.5-.2 0-.5 0-.8 0-.3 0-.7.1-1 .4-.3.2-1 1-1 2.6 0 1.7 1 3.3 1.1 3.5.1.3 1.9 3 4.6 4.2 3 .9 3.3.8 3.9.7.6-.1 2-1 2.3-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.7-.5z" />
                                </svg>
                            </button>
                        ) : null
                    )}
                </TooltipTrigger>
                <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-2 py-1 text-sm cursor-default">
                    {hasPhone ? tooltipText : (showPlaceholder ? (loading ? 'Cargando teléfono' : 'Sin teléfono') : tooltipText)}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export default WhatsAppLink;
