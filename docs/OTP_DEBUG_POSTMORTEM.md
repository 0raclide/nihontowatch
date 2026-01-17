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

## Current State

The latest commit (`619dbef`) includes:
1. Direct fetch call to Supabase `/auth/v1/verify` endpoint
2. Bypasses the Supabase client library entirely
3. If this works, the issue is in the client library
4. If this fails with the same error, the issue is in Supabase project configuration
