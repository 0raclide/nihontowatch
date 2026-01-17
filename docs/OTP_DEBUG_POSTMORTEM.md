# OTP Verification Debug Post-Mortem

## Issue Summary

**Error:** `"Only an email address or phone number should be provided on verify"`

**Context:** User receives 6-digit OTP code via email successfully, but verification fails with the above error when entering the code.

**Key Fact:** The same OTP flow works correctly in oshi-v2 project.

---

## What Works

1. **Email sending works** - User receives email from `noreply@nihontowatch.com` via SendGrid SMTP
2. **Email template is correct** - Uses `{{ .Token }}` which displays the 6-digit code
3. **Code format is correct** - 6-digit numeric codes (e.g., `286031`)
4. **signInWithOtp call succeeds** - No error when requesting the code

---

## What Fails

The `verifyOtp` call fails with: `"Only an email address or phone number should be provided on verify"`

This error comes from Supabase's GoTrue server and is thrown when **both** email AND phone are provided in the verify request body.

---

## Attempts Made

### 1. Client Library Pattern (Module-level Singleton)
**File:** `src/lib/supabase/client.ts`

Changed from creating client inside component to module-level singleton (matching oshi-v2):
```typescript
const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
export function createClient() { return supabase; }
```
**Result:** Same error

### 2. Input Sanitization
**File:** `src/lib/auth/AuthContext.tsx`

Added email/token trimming and lowercase:
```typescript
const cleanEmail = email.trim().toLowerCase();
const cleanToken = token.trim();
```
**Result:** Same error

### 3. Fallback Verification Types
Tried `type: 'email'` first, then `type: 'magiclink'` as fallback.
**Result:** Same error on both attempts

### 4. Added emailRedirectTo Option
Matched oshi-v2's `signInWithOtp` call with `emailRedirectTo` option.
**Result:** Reverted - user wants OTP codes, not magic links

### 5. Package Version Downgrade
Attempted to match oshi-v2 versions:
- `@supabase/ssr`: 0.5.2 (vs 0.8.0)
- `@supabase/supabase-js`: 2.47.0 (vs 2.90.1)

**Result:** Caused TypeScript type incompatibilities with joined table inference. Reverted.

### 6. Direct API Call (Current State)
**File:** `src/lib/auth/AuthContext.tsx`

Bypassed Supabase client entirely with raw fetch:
```typescript
const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
  },
  body: JSON.stringify({
    email: cleanEmail,
    token: cleanToken,
    type: 'email',
  }),
});
```
**Result:** Not yet tested - pushed for deployment

---

## Key Observations

### 1. Error Origin
The error `"Only an email address or phone number should be provided on verify"` comes from GoTrue server code:
```go
if params.Email != "" && params.Phone != "" {
    return badRequestError("Only an email address or phone number should be provided on verify")
}
```
This means the request body contains **both** email and phone, even though our code only sends email.

### 2. oshi-v2 Works
oshi-v2 uses the same Supabase auth pattern and it works. Key differences:
- Different Supabase project? (UNKNOWN - needs verification)
- Older package versions (0.5.2 vs 0.8.0 for @supabase/ssr)
- Uses `emailRedirectTo` in `signInWithOtp` (but still verifies with `type: 'email'`)

### 3. Supabase Project Configuration
User confirmed:
- Magic Link email template uses `{{ .Token }}` (correct for OTP)
- No separate OTP template exists (Magic Link template serves both)
- Email sending works via SendGrid

---

## Unanswered Questions

1. **Are nihontowatch and oshi-v2 using the same Supabase project?**
   - If different, the auth configuration might differ
   - Phone auth might be enabled in one but not the other

2. **Is Phone provider enabled in nihontowatch's Supabase project?**
   - Go to Authentication → Providers → Phone
   - If enabled, try disabling it

3. **Is there cached auth state causing phone to be added?**
   - Even incognito mode didn't help
   - The module-level singleton might preserve state

4. **Is the newer @supabase/ssr (0.8.0) behaving differently?**
   - Version 0.5.2 works in oshi-v2
   - Could be a regression or breaking change

---

## Next Steps for Debugging

### Priority 1: Test Direct API Call
The latest push (commit `619dbef`) uses a direct `fetch` call to `/auth/v1/verify` instead of the Supabase client. Test this first.

### Priority 2: Compare Supabase Projects
1. Check if nihontowatch and oshi-v2 use the **same** Supabase project URL
2. If different projects, compare:
   - Authentication → Providers settings
   - Phone auth enabled/disabled
   - Email auth settings
   - Rate limits and OTP expiry

### Priority 3: Check for Phone Auth Interference
In nihontowatch's Supabase dashboard:
1. Go to Authentication → Providers → Phone
2. If enabled, **disable it** and test again
3. Check if there are any partial phone-related records in auth.users

### Priority 4: Debug Request Body
Add logging to see exactly what's being sent:
```typescript
console.log('Verify request body:', JSON.stringify({
  email: cleanEmail,
  token: cleanToken,
  type: 'email',
}));
```

### Priority 5: Try with New User
The user's email might have some corrupted state. Try:
1. Use a completely new email address
2. Request OTP and verify
3. See if the same error occurs

---

## Relevant Files

| File | Purpose |
|------|---------|
| `src/lib/auth/AuthContext.tsx` | Auth context with signInWithEmail and verifyOtp |
| `src/lib/supabase/client.ts` | Browser Supabase client (singleton) |
| `src/components/auth/LoginModal.tsx` | UI for email input and OTP code entry |
| `src/app/auth/callback/route.ts` | Auth callback for magic links (not currently used) |

---

## Relevant Documentation

- [Supabase signInWithOtp](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [Supabase verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [Supabase Email OTP Guide](https://supabase.com/docs/guides/auth/passwordless-login/auth-email-otp)
- [GitHub Issue: Invite OTPs verification error](https://github.com/supabase/auth/issues/1284)

---

## Environment

- **Framework:** Next.js 16.1.2
- **Packages:**
  - `@supabase/ssr`: 0.8.0
  - `@supabase/supabase-js`: 2.90.1
- **Email Provider:** SendGrid (via Supabase SMTP)
- **Production URL:** https://nihontowatch.com

---

## Resolution (2026-01-17)

### Root Cause: React Stale Closure Bug

The error message `"Only an email address or phone number should be provided on verify"` was a **red herring**. The actual issue was a **React stale closure bug** in the LoginModal component.

#### The Bug

```typescript
// handleOtpChange had [otp] as its only dependency
const handleOtpChange = useCallback(
  (index: number, value: string) => {
    // ...
    if (digit && index === 5 && newOtp.every((d) => d)) {
      handleOtpSubmit(newOtp.join('')); // Called handleOtpSubmit
    }
  },
  [otp]  // Missing email dependency!
);

// handleOtpSubmit used email from component state
const handleOtpSubmit = async (code?: string) => {
  // ...
  const { error } = await verifyOtp(email, otpCode); // email was EMPTY here
};
```

When `handleOtpChange` was created, it captured a reference to `handleOtpSubmit`. But `handleOtpSubmit` captured the `email` state at the time it was defined - which was an **empty string** before the user entered their email.

When the user typed the 6th digit and auto-submit triggered, it called the stale `handleOtpSubmit` with `email = ""`.

#### Debug Evidence

Console logs revealed:
```
[OTP Debug] Request body: {"email":"","token":"595673","type":"email"}
```

The email was empty! Supabase received an empty email and likely had fallback logic that checked for phone, hence the misleading error.

### The Fix

Used a React ref to always access the current email value:

```typescript
const emailRef = useRef(email);
emailRef.current = email; // Keep in sync

const handleOtpSubmit = async (code?: string) => {
  const currentEmail = emailRef.current; // Always current!
  const { error } = await verifyOtp(currentEmail, otpCode);
};
```

### Final Solution

The working implementation uses:
1. **Direct fetch to Supabase API** (`/auth/v1/verify`) instead of client library
2. **React ref for email** to avoid stale closure in callbacks
3. **`setSession()` after verification** to establish the authenticated session

---

## Lessons Learned

### 1. Error Messages Can Be Misleading
The Supabase error `"Only an email address or phone number should be provided"` suggested both were being sent. In reality, **neither** was being sent correctly - the email was empty. Always add debug logging to see the actual request payload.

### 2. React Closures Are Treacherous
When using `useCallback` with functions that call other functions:
- The inner function captures state at definition time
- If the outer callback's dependency array is incomplete, the inner function becomes stale
- **Solution:** Use refs for values that need to be current in deeply nested callbacks

### 3. Auto-Submit Features Need Extra Care
The auto-submit on 6th digit feature triggered a complex callback chain:
```
handleOtpChange → handleOtpSubmit → verifyOtp
```
Each hop in this chain can introduce stale closure bugs. Test auto-submit paths separately from manual submit.

### 4. Debug with Console Logs First
Before diving into complex hypotheses (Supabase client bugs, phone auth settings, package versions), simple `console.log` statements revealed the true issue in seconds.

### 5. Direct API Calls as Escape Hatch
When client libraries behave unexpectedly, bypassing them with direct `fetch` calls can:
- Isolate whether the issue is client-side or server-side
- Provide a working solution while investigating
- Give you full control over the request payload

---

## Final State

**Resolved in commit:** `104711f`

**Working flow:**
1. User enters email → `signInWithOtp()` sends 6-digit code
2. User enters code → auto-submits on 6th digit
3. `verifyOtp()` sends direct fetch to `/auth/v1/verify`
4. On success, `setSession()` establishes authenticated state
5. Modal closes, user is logged in

**Files modified:**
- `src/components/auth/LoginModal.tsx` - Added emailRef for stale closure fix
- `src/lib/auth/AuthContext.tsx` - Direct API call for verification
