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
  if (items.length === 0) return null;

  const bgClass =
    color === 'orange'
      ? 'bg-orange-100 text-orange-800 border-orange-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';

  const visibleItems = items.slice(0, maxVisible);
  const hiddenItems = items.slice(maxVisible);
  const hasOverflow = hiddenItems.length > 0;

  return (
    <div className="flex flex-wrap gap-1">
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
  );
}
