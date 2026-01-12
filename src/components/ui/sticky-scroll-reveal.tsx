"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// StickyScroll
// Strategy:
// - Compute `desiredScrollTop` for each item (the scrollTop needed to center that item)
// - Keep `topSpacer` and `bottomSpacer` dynamically adjusted so first/last items can be centered
// - On scroll, pick the item whose `desiredScrollTop` is closest to the current scrollTop,
//   with small hysteresis and explicit top/bottom thresholds to avoid flicker.
export const StickyScroll = ({
  content,
  contentClassName,
}: {
  content: {
    title: string;
    description: string;
    content?: React.ReactNode | any;
  }[];
  contentClassName?: string;
}) => {
  const [activeCard, setActiveCard] = React.useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const cardLength = content.length;

  // Keep a ref of the active card to avoid stale closures inside the scroll handler
  const activeRef = useRef<number>(activeCard);
  useEffect(() => {
    activeRef.current = activeCard;
  }, [activeCard]);

  // Refs for each item to measure position
  const itemRefs = useRef<HTMLDivElement[]>([]);
  const rafRef = useRef<number | null>(null);

  // Dynamic top/bottom spacer heights so first/last items can center properly
  const [topSpacer, setTopSpacer] = useState<number | null>(null);
  const [bottomSpacer, setBottomSpacer] = useState<number | null>(null);

  // desired scroll positions used by scroll handler
  const desiredScrollRef = useRef<number[]>([]);
  const didAutoScrollRef = useRef<boolean>(false);
  // Margin that determines how much 'extra' scroll the first card tolerates before losing focus
  const firstMarginRef = useRef<number>(48);

  // Recompute spacer sizes and desired scroll positions whenever container or items change
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const recompute = () => {
      const rect = container.getBoundingClientRect();
      const containerHeight = rect.height;

      const firstItem = itemRefs.current[0];
      let itemHeight = 256; // fallback when not measured yet
      if (firstItem) {
        const r = firstItem.getBoundingClientRect();
        itemHeight = r.height;
      }
      // Set first-item margin proportional to item height so behaviour scales with layout
      // Increase baseline so small scrolls don't immediately move focus away from first item
      firstMarginRef.current = Math.max(64, Math.round(itemHeight * 0.75));

      // Compute a tighter top spacer to avoid large blank gaps under the title
      // make it even smaller on narrow content so the first item sits closer to the title
      const rawSpacer = Math.max(4, Math.round(containerHeight / 2 - itemHeight / 2));
      const maxTopSpacer = Math.round(Math.min(64, containerHeight * 0.1));
      const spacer = Math.min(rawSpacer, maxTopSpacer);

      setTopSpacer(spacer);

      // provisional bottom spacer
      let provisionalBottom = Math.max(Math.round(itemHeight), 48);
      setBottomSpacer(provisionalBottom);

      // Compute desired scrollTop for each item (based on current DOM layout)
      const desired: number[] = [];
      itemRefs.current.forEach((el) => {
        if (!el) return;
        const offsetTop = (el as HTMLElement).offsetTop;
        const r = el.getBoundingClientRect();
        desired.push(offsetTop - Math.round(container.clientHeight / 2 - r.height / 2));
      });

      // Ensure last desired is reachable; if not, increase bottom spacer
      if (desired.length > 0) {
        const lastDesired = desired[desired.length - 1];
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        if (lastDesired > maxScrollTop) {
          const extra = lastDesired - maxScrollTop + 24; // small margin
          provisionalBottom = Math.max(provisionalBottom, Math.round(extra));
          setBottomSpacer(provisionalBottom);

          // after changing bottom spacer, recompute desired in next frame
          window.requestAnimationFrame(() => {
            const desired2: number[] = [];
            itemRefs.current.forEach((el) => {
              if (!el) return;
              const offsetTop = (el as HTMLElement).offsetTop;
              const r = el.getBoundingClientRect();
              desired2.push(offsetTop - Math.round(container.clientHeight / 2 - r.height / 2));
            });
            desiredScrollRef.current = desired2;

            // Auto-scroll on first render to align first item horizontally with the preview
            if (!didAutoScrollRef.current && container.scrollTop <= 8 && desired2.length > 0) {
              didAutoScrollRef.current = true;
              // set immediately to avoid jumpy animation; user can still scroll afterwards
              container.scrollTop = Math.max(0, Math.min(maxScrollTop, desired2[0]));
              setActiveCard(0);
              activeRef.current = 0;
            }
          });
        } else {
          desiredScrollRef.current = desired;

          // Auto-scroll on first render to align first item horizontally with the preview
          if (!didAutoScrollRef.current && container.scrollTop <= 8 && desired.length > 0) {
            didAutoScrollRef.current = true;
            const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
            container.scrollTop = Math.max(0, Math.min(maxScrollTop, desired[0]));
            setActiveCard(0);
            activeRef.current = 0;
          }
        }
      } else {
        desiredScrollRef.current = [];
      }
    };

    recompute();
    // Ensure the first card is active by default (don't force scroll if already scrolled)
    setActiveCard(0);

    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    window.addEventListener("resize", recompute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [content.length]);

  // On scroll, pick the item whose center is closest to the container center
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);

        // If near top, activate first (quick guard)
        const topThreshold = 24;
        if (scrollTop <= topThreshold) {
          if (activeRef.current !== 0) {
            setActiveCard(0);
            activeRef.current = 0;
          }
          return;
        }

        // If near bottom, activate last
        const bottomThreshold = 24;
        if (scrollTop >= maxScrollTop - bottomThreshold) {
          const last = Math.max(0, content.length - 1);
          if (activeRef.current !== last) {
            setActiveCard(last);
            activeRef.current = last;
          }
          return;
        }

        const desired = desiredScrollRef.current;
        if (!desired || desired.length === 0) return;

        // Prefer to keep the first card active until we pass its configured margin
        const firstDesired = desired[0];
        if (typeof firstDesired === 'number') {
          const firstMargin = firstMarginRef.current ?? 48;
          if (scrollTop <= firstDesired + firstMargin) {
            if (activeRef.current !== 0) {
              setActiveCard(0);
              activeRef.current = 0;
            }
            return;
          }
        }

        // pick candidate by minimal distance to desired scroll position
        let candidate = 0;
        let bestDist = Math.abs(scrollTop - desired[0]);
        for (let i = 1; i < desired.length; i++) {
          const d = Math.abs(scrollTop - desired[i]);
          if (d < bestDist) {
            bestDist = d;
            candidate = i;
          }
        }

        const current = activeRef.current;
        const currentDist = desired[current] !== undefined ? Math.abs(scrollTop - desired[current]) : Infinity;
        const hysteresis = 32; // px — increase further to avoid flips on micro-scrolls

        if (candidate !== current && bestDist + hysteresis < currentDist) {
          setActiveCard(candidate);
          activeRef.current = candidate;
        }
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    // initialize - keep the first card active by default without forcing a scroll
    setActiveCard(0);

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [content.length]);

  // Background visuals are handled by the landing layout; keep this component background-transparent
  // and let the landing page decide the page background. Removed animated colors and gradients.

  return (
    <motion.div
      className="relative flex w-full h-[55vh] md:h-[48rem] justify-center space-x-10 overflow-y-auto hide-scrollbar p-10"
      ref={ref}
    >
      <div className="relative flex items-start px-4">
        <div className="max-w-2xl">
          {/* Top spacer so the first card can be centered */}
          <div style={{ height: topSpacer ?? undefined }} className="w-full" />

          {content.map((item, index) => (
            <div
              key={item.title + index}
              ref={(el) => (itemRefs.current[index] = el as HTMLDivElement)}
              className="h-64 flex items-center"
            >
              <div className="max-w-2xl w-full">
                <div className="flex items-start gap-6">
                  <div className={cn("flex-shrink-0 transition-opacity duration-200", activeCard === index ? "opacity-100" : "opacity-30")}>
                    {item.icon ?? <div className="w-12 h-12 rounded-md bg-neutral-100" />}
                  </div>
                  <div>
                    <motion.h2
                      initial={{
                        opacity: 0,
                      }}
                      animate={{
                        opacity: activeCard === index ? 1 : 0.3,
                      }}
                      className="text-2xl font-bold text-neutral-900 dark:text-white"
                    >
                      {item.title}
                    </motion.h2>
                    <motion.p
                      initial={{
                        opacity: 0,
                      }}
                      animate={{
                        opacity: activeCard === index ? 1 : 0.3,
                      }}
                      className="text-lg mt-4 max-w-sm text-neutral-900 dark:text-neutral-300"
                    >
                      {item.description}
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Extra spacer so last card can be centered when scrolling */}
          <div style={{ height: bottomSpacer ?? undefined }} className="w-full" />
        </div>
      </div>
      <div
        className={cn(
          "sticky top-1/2 -translate-y-1/2 transform hidden overflow-hidden rounded-md bg-transparent lg:block",
          contentClassName,
        )}
      >
        {content[activeCard].content ?? null}
      </div>
    </motion.div>
  );
};
