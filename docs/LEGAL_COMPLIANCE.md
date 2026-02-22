# Legal Compliance

## Geo-Gated Cookie Consent (GDPR)

The cookie consent banner is **geo-gated** — only shown to visitors from EU/EEA (27+3) and UK jurisdictions. Non-GDPR visitors (US, Japan, etc.) never see the banner and analytics tracking is implicitly consented.

Since nihontowatch has no third-party tracking (no GA, no Meta Pixel — only first-party API-based analytics), the banner is unnecessary for non-GDPR regions.

### How It Works

1. **Middleware** reads `x-vercel-ip-country` on first visit → sets `nw-gdpr=1` (GDPR region) or `nw-gdpr=0` (non-GDPR) cookie for 1 year
2. **Server layout** reads cookie → passes `isGdprRegion` boolean to `<ConsentProvider>`
3. **ConsentProvider** only shows the banner for GDPR visitors with no stored consent
4. **`hasAnalyticsConsent()`** defaults `true` for non-GDPR, `false` for GDPR (until explicit opt-in)

Cookie persists from first visit — no flip-flopping on VPN changes. Local dev (no `x-vercel-ip-country` header) defaults to non-GDPR (no banner).

### GDPR Jurisdictions (31)

AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GR, HR, HU, IE, IS, IT, LI, LT, LU, LV, MT, NL, NO, PL, PT, RO, SE, SI, SK

(27 EU member states + Iceland, Liechtenstein, Norway + UK)

### Behavior Matrix

| Scenario | Banner | Analytics |
|----------|--------|-----------|
| US first visit | Hidden | ON immediately |
| EU first visit | Shown | OFF until opt-in |
| Return visit (consented) | Hidden | Per stored preference |
| Policy version bump | Re-shown (GDPR only) | Per stored preference |
| Local dev (no header) | Hidden | ON (defaults non-GDPR) |

### Key Files

| Component | Location |
|-----------|----------|
| GDPR country codes | `src/lib/consent/gdpr.ts` (`GDPR_COOKIE`, `GDPR_COUNTRY_CODES`, `isGdprCountry()`) |
| Server-side reader | `src/lib/consent/server.ts` (`getServerGdprRegion()`) |
| Cookie setting | `src/middleware.ts` (after locale cookie block) |
| Region prop wiring | `src/app/layout.tsx` (`isGdprRegion` prop to ConsentProvider) |
| Banner gating | `src/contexts/ConsentContext.tsx` (`isGdprRegion` prop) |
| Analytics default | `src/lib/consent/helpers.ts` (`isGdprRegionFromCookie()`, `hasAnalyticsConsent()`) |
| Barrel export | `src/lib/consent/index.ts` |

### Testing

1. **Local (non-GDPR):** Clear cookies + localStorage, reload — no banner, tracking works
2. **Local (GDPR):** Set `document.cookie = 'nw-gdpr=1'`, clear localStorage, reload — banner appears
3. **Verify analytics off for GDPR:** With `nw-gdpr=1` and no consent record, `hasAnalyticsConsent()` returns `false`
4. **Verify analytics on for non-GDPR:** With `nw-gdpr=0` and no consent record, `hasAnalyticsConsent()` returns `true`
5. **Verify accept/reject still works:** Click accept in GDPR mode, reload — banner stays hidden
