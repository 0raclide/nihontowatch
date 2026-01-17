'use client';

import { Suspense, type ReactNode } from 'react';
import { ActivityProvider } from './ActivityProvider';

interface ActivityWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper component that provides activity tracking with Suspense boundary
 * Required because ActivityProvider uses useSearchParams which needs Suspense
 */
export function ActivityWrapper({ children }: ActivityWrapperProps) {
  return (
    <Suspense fallback={<>{children}</>}>
      <ActivityProvider>
        {children}
      </ActivityProvider>
    </Suspense>
  );
}
