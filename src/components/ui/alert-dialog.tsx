import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => {
  const localRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (!ref) return;
    if (typeof ref === 'function') ref(node);
    else (ref as any).current = node;
  };

  // Helper to detect whether a Description element is present among descendants
  const hasDescription = (children: React.ReactNode): boolean => {
    const arr = React.Children.toArray(children);
    for (const child of arr) {
      if (!React.isValidElement(child)) continue;
      const type: any = (child as any).type;
      // Direct primitive Description or our wrapper (matching by displayName)
      if (
        type === AlertDialogPrimitive.Description ||
        (type && type.displayName === AlertDialogPrimitive.Description.displayName)
      ) {
        return true;
      }
      if (child.props?.children && hasDescription(child.props.children)) return true;
    }
    return false;
  };

  const missingDescription = !hasDescription((props as any).children);
  const hasExplicitAriaDesc = (props as any)['aria-describedby'] !== undefined && (props as any)['aria-describedby'] !== null;
  const shouldInjectDesc = missingDescription && !hasExplicitAriaDesc;
  const generatedId = React.useId();
  const descId = `alert-desc-${generatedId}`;

  // Build content props so user-provided props do not override an injected aria-describedby
  const contentProps: any = { ...props };
  if (shouldInjectDesc && (contentProps['aria-describedby'] === undefined || contentProps['aria-describedby'] === null)) {
    contentProps['aria-describedby'] = descId;
  }

  // In development, ensure an element with the description id exists in the DOM
  // early so Radix's internal DescriptionWarning can reliably detect it even
  // during strict-mode double renders or timing races. Use a layout effect so
  // the helper element is inserted synchronously before Radix runs its checks.
  React.useLayoutEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!shouldInjectDesc) return;

    // Avoid creating duplicate helper elements if one already exists
    if (document.getElementById(descId)) return;

    const el = document.createElement('div');
    el.id = descId;
    el.className = 'sr-only';
    el.textContent = 'Confirmación requerida';
    document.body.appendChild(el);

    return () => {
      try {
        const existing = document.getElementById(descId);
        if (existing) document.body.removeChild(existing);
      } catch { }
    };
  }, [shouldInjectDesc, descId]);

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={setRefs}
        tabIndex={-1}
        // When the alert opens, ensure focus moves into the alert container
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          try {
            (document.activeElement as HTMLElement | null)?.blur();
          } catch { }
          localRef.current?.focus();
        }}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state-closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg',
          className
        )}
        {...contentProps}
      >
        {shouldInjectDesc ? (
          <AlertDialogDescription id={descId} className="sr-only">
            Confirmación requerida
          </AlertDialogDescription>
        ) : null}
        {(props as any).children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
