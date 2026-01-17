'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

// ============================================================================
// Types
// ============================================================================

type Step = 'email' | 'otp';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { signInWithEmail, verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submitInProgress = useRef(false);

  useBodyScrollLock(isOpen);

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen && step === 'email') {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [isOpen, step]);

  // Focus first OTP input when switching to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('email');
        setEmail('');
        setOtp(['', '', '', '', '', '']);
        setError(null);
        setSuccessMessage(null);
        submitInProgress.current = false;
      }, 200);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Handle email submission
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signInWithEmail(email);

      if (signInError) {
        setError(signInError.message);
      } else {
        setSuccessMessage('Code sent! Check your email.');
        setTimeout(() => {
          setSuccessMessage(null);
          setStep('otp');
        }, 1000);
      }
    } catch (err) {
      console.error('Email submit error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle OTP submission - SIMPLE, no useCallback
  async function handleOtpSubmit(code: string) {
    // Prevent double submit
    if (submitInProgress.current || isLoading) {
      return;
    }

    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    submitInProgress.current = true;
    setError(null);
    setIsLoading(true);

    try {
      const { error: verifyError } = await verifyOtp(email, code);

      if (verifyError) {
        setError(verifyError.message);
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        setSuccessMessage('Login successful!');
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch (err) {
      console.error('OTP submit error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
      submitInProgress.current = false;
    }
  }

  // Handle OTP input change - SIMPLE, no useCallback
  function handleOtpChange(index: number, value: string) {
    const digit = value.slice(-1);
    if (digit && !/^\d$/.test(digit)) return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (digit && index === 5 && newOtp.every((d) => d)) {
      handleOtpSubmit(newOtp.join(''));
    }
  }

  // Handle OTP paste
  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();

    if (pastedData.length === 6) {
      handleOtpSubmit(pastedData);
    }
  }

  // Handle OTP key down (backspace)
  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  // Handle form submission for OTP step
  function handleOtpFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleOtpSubmit(otp.join(''));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-cream rounded-lg shadow-xl animate-slideUp"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted hover:text-ink transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="font-serif text-2xl text-ink mb-2">
              {step === 'email' ? 'Welcome' : 'Enter Code'}
            </h2>
            <p className="text-sm text-muted">
              {step === 'email'
                ? 'Sign in with your email address'
                : `We sent a code to ${email}`}
            </p>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 text-sm rounded-lg text-center">
              {successMessage}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs uppercase tracking-wider text-muted mb-2"
                >
                  Email Address
                </label>
                <input
                  ref={emailInputRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-linen/50 border border-border rounded-lg text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full py-3 bg-gold hover:bg-gold/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    Sending...
                  </>
                ) : (
                  'Continue with Email'
                )}
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleOtpFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-3 text-center">
                  6-Digit Code
                </label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      disabled={isLoading}
                      className="w-12 h-14 text-center text-xl font-mono bg-linen/50 border border-border rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all disabled:opacity-50"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.some((d) => !d)}
                className="w-full py-3 bg-gold hover:bg-gold/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    Verifying...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              {/* Back button */}
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp(['', '', '', '', '', '']);
                  setError(null);
                }}
                disabled={isLoading}
                className="w-full py-2 text-sm text-muted hover:text-ink transition-colors disabled:opacity-50"
              >
                Use a different email
              </button>
            </form>
          )}

          {/* Footer */}
          <p className="mt-6 text-xs text-muted text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Spinner Component
// ============================================================================

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
