import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks which section element is currently in the "active" zone of a scroll container.
 * Returns the id of the most visible section, or null if none are in view.
 *
 * Looks for DOM elements with id matching each sectionId (e.g. 'stream-setsumei').
 * The rootMargin places the "active" trigger zone in the upper ~40% of the container.
 */
export function useScrollSpy(
  sectionIds: string[],
  scrollContainerRef: RefObject<HTMLElement | null>
): string | null {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const visibleSections = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry);
          } else {
            visibleSections.delete(entry.target.id);
          }
        }

        // Pick the section with the highest intersection ratio
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, entry] of visibleSections) {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            best = id;
          }
        }
        setActiveSection(best);
      },
      {
        root: container,
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
      visibleSections.clear();
    };
  }, [sectionIds, scrollContainerRef]);

  return activeSection;
}
