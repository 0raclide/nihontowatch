'use client';

import { type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { SignupPressureProvider } from '@/contexts/SignupPressureContext';
import { SignupModal } from './SignupModal';

interface SignupPressureWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper component that connects SignupPressureProvider with AuthContext.
 * This component should be placed inside AuthProvider in the component tree.
 */
export function SignupPressureWrapper({ children }: SignupPressureWrapperProps) {
  const { user } = useAuth();
  const isAuthenticated = user !== null;

  return (
    <SignupPressureProvider isAuthenticated={isAuthenticated}>
      {children}
      <SignupModal />
    </SignupPressureProvider>
  );
}
