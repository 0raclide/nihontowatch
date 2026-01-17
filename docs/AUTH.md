# Authentication System

## Overview

Nihontowatch uses **Supabase Auth** with **email OTP (One-Time Password)** for passwordless authentication. Users sign in by entering their email, receiving a 6-digit code, and verifying it.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   LoginModal    │────▶│   AuthContext   │────▶│  Supabase Auth  │
│  (UI Component) │     │   (React Hook)  │     │    (Backend)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Components

### AuthContext (`src/lib/auth/AuthContext.tsx`)

Provides authentication state and methods to the entire app:

```typescript
interface AuthContextValue {
  user: User | null;           // Current Supabase user
  profile: Profile | null;     // User profile from profiles table
  session: Session | null;     // Current session
  isLoading: boolean;          // Auth state loading
  isAdmin: boolean;            // Is user an admin
  signInWithEmail(email: string): Promise<{ error: AuthError | null }>;
  verifyOtp(email: string, token: string): Promise<{ error: AuthError | null }>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}
```

### LoginModal (`src/components/auth/LoginModal.tsx`)

Two-step modal UI:
1. **Email Step**: User enters email, receives OTP via email
2. **OTP Step**: User enters 6-digit code, verifies and logs in

Features:
- Auto-advance between OTP input fields
- Auto-submit when all 6 digits entered
- Paste support for full OTP code
- Keyboard navigation (backspace to previous field)
- Loading states and error handling

## Authentication Flow

```
1. User clicks "Sign In"
   └── LoginModal opens (email step)

2. User enters email, clicks "Continue"
   └── signInWithEmail(email) called
   └── Supabase sends OTP email
   └── Modal switches to OTP step

3. User enters 6-digit code
   └── verifyOtp(email, code) called
   └── supabase.auth.verifyOtp() validates code
   └── Session established automatically
   └── onAuthStateChange fires with SIGNED_IN
   └── Modal closes, user logged in
```

## Database Tables

### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user',  -- 'user' | 'admin'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### user_favorites
```sql
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  listing_id INTEGER REFERENCES listings(id),
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, listing_id)
);
```

## Protected Routes

### Middleware (`src/middleware.ts`)

Protects `/admin/*` routes:
- Redirects unauthenticated users to `/?login=admin`
- Checks `profiles.role = 'admin'` for admin access
- Returns 401/403 for protected API routes

### Admin Layout (`src/app/admin/layout.tsx`)

Client-side admin check as fallback:
- Shows loading state while checking auth
- Redirects non-admins to home page

## API Routes

### `/api/favorites`
- `GET` - Fetch user's favorites with listing details
- `POST` - Add listing to favorites
- `DELETE` - Remove listing from favorites

All require authentication (401 if not logged in).

## Key Implementation Notes

### Why Plain Functions Instead of useCallback

The OTP handlers use plain functions instead of `useCallback` to avoid stale closure issues:

```typescript
// GOOD - Plain function, always has current values
async function handleOtpSubmit(code: string) {
  const { error } = await verifyOtp(email, code);
  // ...
}

// BAD - useCallback can capture stale verifyOtp
const handleOtpSubmit = useCallback(async (code: string) => {
  const { error } = await verifyOtp(email, code); // might be stale!
}, [verifyOtp]);
```

### Supabase Client Pattern

- **Browser**: Singleton client in `src/lib/supabase/client.ts`
- **Server**: Per-request client in `src/lib/supabase/server.ts` (uses cookies)

### Session Management

Supabase handles session storage automatically via cookies. The `onAuthStateChange` listener in AuthContext keeps React state in sync.

## Troubleshooting

### Login spinner hangs forever
- Check browser console for errors
- Verify Supabase URL and anon key in `.env.local`
- Ensure OTP email was received and code is correct

### "Maximum update depth exceeded" warning
- Usually from unstable callback references
- Check if any `useCallback` dependencies change on every render

### 401 on API routes after login
- Session cookies may not be set properly
- Check `src/middleware.ts` session refresh logic
