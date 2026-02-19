'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Global navigation progress bar. Listens for 'nav-progress-start' DOM events
 * and shows a thin gold bar at the top of the viewport that animates until
 * the pathname changes (navigation completes).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const safetyRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const startPathRef = useRef(pathname);

  // Listen for nav-progress-start events
  useEffect(() => {
    const handleStart = () => {
      startPathRef.current = pathname;
      setActive(true);
      setFading(false);
      setProgress(0);

      // Animate progress: 0 → 30% (50ms) → 60% (300ms) → 80% (800ms)
      setTimeout(() => setProgress(30), 50);
      setTimeout(() => setProgress(60), 300);
      setTimeout(() => setProgress(80), 800);

      // Safety timeout: clear after 8s if navigation never completes
      clearTimeout(safetyRef.current);
      safetyRef.current = setTimeout(() => {
        setProgress(100);
        setFading(true);
        setTimeout(() => {
          setActive(false);
          setProgress(0);
          setFading(false);
        }, 300);
      }, 8000);
    };

    window.addEventListener('nav-progress-start', handleStart);
    return () => {
      window.removeEventListener('nav-progress-start', handleStart);
      clearTimeout(timerRef.current);
      clearTimeout(safetyRef.current);
    };
  }, [pathname]);

  // When pathname changes, complete the bar
  useEffect(() => {
    if (active && pathname !== startPathRef.current) {
      clearTimeout(safetyRef.current);
      setProgress(100);
      setFading(true);
      timerRef.current = setTimeout(() => {
        setActive(false);
        setProgress(0);
        setFading(false);
      }, 300);
    }
  }, [pathname, active]);

  if (!active) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease' }}
    >
      <div
        className="h-full bg-gold"
        style={{
          width: `${progress}%`,
          transition: progress === 0
            ? 'none'
            : progress === 100
              ? 'width 0.15s ease-out'
              : 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  );
}
