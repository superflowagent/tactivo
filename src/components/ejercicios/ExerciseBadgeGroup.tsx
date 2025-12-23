import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface BadgeItem {
    id: string;
    name: string;
}

interface ExerciseBadgeGroupProps {
    items: BadgeItem[];
    color: "orange" | "blue";
    maxVisible?: number;
}

export function ExerciseBadgeGroup({
    items,
    color,
    maxVisible = 2,
}: ExerciseBadgeGroupProps) {
    if (items.length === 0) return null;

    const bgClass = color === "orange"
        ? "bg-orange-100 text-orange-800 border-orange-200"
        : "bg-blue-100 text-blue-800 border-blue-200";

    const visibleItems = items.slice(0, maxVisible);
    const hiddenItems = items.slice(maxVisible);
    const hasOverflow = hiddenItems.length > 0;

    return (
        <div className="flex flex-wrap gap-1">
            {visibleItems.map((item) => (
                <Badge
                    key={item.id}
                    variant="secondary"
                    className={`text-xs truncate ${bgClass}`}
                    title={item.name}
                >
                    {item.name}
                </Badge>
            ))}
            {hasOverflow && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge
                                variant="secondary"
                                className={`text-xs cursor-help ${bgClass}`}
                            >
                                +{hiddenItems.length}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <div className="space-y-1">
                                {hiddenItems.map((item) => (
                                    <div key={item.id} className="text-sm">
                                        {item.name}
                                    </div>
                                ))}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
}
