import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BadgeItem {
  id: string;
  name: string;
}

interface ExerciseBadgeGroupProps {
  items: BadgeItem[];
  color: 'orange' | 'blue';
  maxVisible?: number;
}

export function ExerciseBadgeGroup({ items, color, maxVisible = 2 }: ExerciseBadgeGroupProps) {
  const bgClass =
    color === 'orange'
      ? 'bg-orange-100 text-orange-800 border-orange-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';

  // Guard: keep hooks at top-level to satisfy rules-of-hooks; render null if no items

  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(Math.min(maxVisible, items.length));

  useLayoutEffect(() => {
    // Synchronize initial visible count with maxVisible
    setVisibleCount(Math.min(maxVisible, items.length));
  }, [maxVisible, items.length]);


  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const containerWidth = container.clientWidth;
      const style = getComputedStyle(container);
      const gapValue = style.gap || style.columnGap || '4px';
      const gapPx = parseFloat(gapValue);

      // measure widths of each badge (rendered in measure div)
      const badgeEls = Array.from(measure.querySelectorAll<HTMLElement>('.measure-badge'));
      const badgeWidths = badgeEls.map((el) => el.offsetWidth);

      const plusEl = measure.querySelector<HTMLElement>('.measure-plus');
      const plusWidth = plusEl ? plusEl.offsetWidth : 0;

      let sum = 0;
      let count = 0;

      for (let i = 0; i < badgeWidths.length; i++) {
        const w = badgeWidths[i];
        // If we add this badge (and the gaps between previous badges), check if it still fits.
        const predicted = sum + (count > 0 ? gapPx : 0) + w;

        // If there are more remaining after this one, we must also ensure a place for the +N button
        const remaining = badgeWidths.length - (i + 1);
        const needsPlus = remaining > 0;
        const predictedWithPlus = predicted + (needsPlus ? (gapPx + plusWidth) : 0);

        if (predictedWithPlus <= containerWidth) {
          sum = predicted;
          count++;
        } else {
          break;
        }
      }

      // At least show 0..items.length
      const finalCount = Math.max(0, Math.min(count || 0, items.length));

      // If nothing fits, fall back to showing at least 1 unless container too small
      const result = finalCount > 0 ? finalCount : (items.length > 0 && badgeWidths[0] <= containerWidth ? 1 : 0);

      setVisibleCount(result);
    };

    // initial compute
    compute();

    // observe resize
    const ro = new ResizeObserver(() => compute());
    ro.observe(container);

    // also compute on window resize
    const onWin = () => compute();
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
    };
  }, [items, maxVisible]);

  // If no items, short-circuit render (hooks have already been called)
  if (items.length === 0) return null;

  const visibleItems = items.slice(0, visibleCount);
  const hiddenItems = items.slice(visibleCount);
  const hasOverflow = hiddenItems.length > 0;

  return (
    <>
      <div ref={containerRef} className="flex flex-wrap gap-1">
        {visibleItems.map((item) => (
          <Badge
            key={item.id}
            variant="secondary"
            className={`text-xs truncate ${bgClass} cursor-default rounded`}
          >
            {item.name}
          </Badge>
        ))}

        {hasOverflow && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Mostrar ${hiddenItems.length} elementos`}
                  className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-normal ${bgClass} cursor-default`}
                >
                  +{hiddenItems.length}
                </button>
              </TooltipTrigger>
              <TooltipContent
                className={`${color === 'orange' ? 'bg-orange-100 border-orange-200' : 'bg-blue-100 border-blue-200'} border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default`}
              >
                {hiddenItems.map((i) => i.name).join(', ')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        aria-hidden
        style={{ position: 'absolute', left: -9999, top: -9999, visibility: 'hidden', height: 'auto', overflow: 'visible' }}
      >
        {items.map((item) => (
          <span key={item.id} className={`measure-badge inline-block text-xs truncate ${bgClass} cursor-default rounded px-2.5 py-0.5`}>
            {item.name}
          </span>
        ))}
        <span className={`measure-plus inline-block px-2.5 py-0.5 text-xs rounded ${bgClass}`}>+99</span>
      </div>
    </>
  );
}
