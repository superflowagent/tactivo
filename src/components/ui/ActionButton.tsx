import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: React.ReactNode;
  tooltipClassName?: string;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    { tooltip, tooltipClassName, className, children, ...props }: ActionButtonProps,
    ref
  ) {
    const button = (
      <button ref={ref} type="button" className={cn('action-icon', className)} {...props}>
        {children}
      </button>
    );

    if (!tooltip) return button;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent
            className={cn(
              'bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default',
              tooltipClassName
            )}
          >
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

export default ActionButton;
