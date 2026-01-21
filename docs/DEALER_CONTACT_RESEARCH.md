# Dealer Contact Research Spec

This document specifies the dealer contact information required for the AI Email Drafting feature.

## Purpose

The AI Email Drafting feature needs dealer contact information to:
1. Pre-fill dealer email addresses for inquiries
2. Display known policies (shipping, payment, deposit) to buyers
3. Help buyers understand what to expect from each dealer

## Database Schema

The following columns have been added to the `dealers` table:

| Column | Type | Description |
|--------|------|-------------|
| `contact_email` | TEXT | Primary contact email for inquiries |
| `contact_page_url` | TEXT | URL to dealer's contact page |
| `sales_policy_url` | TEXT | URL to sales/purchasing policy page |
| `ships_international` | BOOLEAN | `true` = ships overseas, `false` = Japan only, `null` = unknown |
| `accepts_wire_transfer` | BOOLEAN | Accepts bank wire transfer |
| `accepts_paypal` | BOOLEAN | Accepts PayPal payments |
| `accepts_credit_card` | BOOLEAN | Accepts credit card payments |
| `requires_deposit` | BOOLEAN | Requires deposit before shipping |
| `deposit_percentage` | NUMERIC(5,2) | Deposit percentage (e.g., 30.00 for 30%) |
| `english_support` | BOOLEAN | `true` = has English support, `false` = Japanese only |

## Research Priority

Research dealers in order of listing count (highest first):

### Tier 1 - Top 10 (Priority)

| # | Dealer | Domain | Est. Listings |
|---|--------|--------|---------------|
| 1 | Aoi Art | aoijapan.com | ~500+ |
| 2 | Nipponto | nipponto.co.jp | ~400+ |
| 3 | Eirakudo | eirakudo.com | ~300+ |
| 4 | Ginza Seikodo | ginza-seikodo.com | ~250+ |
| 5 | Choshuya | choshuya.co.jp | ~200+ |
| 6 | E-sword | e-sword.jp | ~200+ |
| 7 | Samurai Nippon | samurai-nippon.net | ~150+ |
| 8 | Kusanagi | kusanaginosya.com | ~150+ |
| 9 | Iida Koendo | iida-koendo.com | ~100+ |
| 10 | Taiseido | taiseido.net | ~100+ |

### Tier 2 - Remaining Japanese Dealers

| Dealer | Domain |
|--------|--------|
| Katana Ando | katana-ando.com |
| Katanahanbai | katanahanbai.com |
| Shoubudou | shoubudou.jp |
| Premi | premi.co.jp |
| Gallery Youyou | gallery-youyou.com |
| Hyozaemon | hyozaemon.com |
| Tsuruginoya | tsuruginoya.com |
| Touken Matsumoto | touken-matsumoto.jp |
| Touken Komachi | toukenkomachi.com |
| Touken Sakata | touken-sakata.com |
| Token-Net | token-net.com |
| World Seiyudo | world-seiyudo.com |
| Tokka Biz | tokka.biz |
| Sanmei | sanmei.com |

### Tier 3 - Western Dealers

| Dealer | Domain | Country |
|--------|--------|---------|
| Nihonto | nihonto.com | USA |
| Nihonto Art | nihontoart.com | USA |
| Swords of Japan | swordsofjapan.com | USA |

## Research Instructions

For each dealer, find:

### 1. Contact Email
- Check `/contact`, `/about`, `/inquiry`, `/shop-info` pages
- Look in page footer/header
- Check "特定商取引法に基づく表記" (Tokutei Shotorihikiho) page - legally required in Japan
- Common patterns: `info@`, `sales@`, `contact@`, `shop@`

### 2. Sales Policy URL
- Look for "ご購入について", "お買い物ガイド", "Purchasing Guide"
- Japanese dealers often have detailed policy pages

### 3. Shipping Policy
- Check if they explicitly mention overseas/international shipping
- Look for "海外発送", "International Shipping", "Overseas"
- Note any restrictions (e.g., "Japan only", "Ask for quote")

### 4. Payment Methods
- Look for "お支払い方法", "Payment Methods"
- Common methods:
  - Bank transfer (銀行振込) - very common in Japan
  - PayPal - increasingly common for international
  - Credit card - less common for high-value items

### 5. Deposit Requirements
- Look for "内金", "前金", "deposit"
- Common: 30-50% deposit, balance before shipping
- Some require full payment upfront

### 6. English Support
- Check if site has English version
- Look for English email address or contact form
- Note if they explicitly mention English support

## Data Format

Submit research as JSON for easy import:

```json
{
  "dealer_name": "Aoi Art",
  "contact_email": "info@aoijapan.com",
  "contact_page_url": "https://www.aoijapan.com/contact/",
  "sales_policy_url": "https://www.aoijapan.com/shopping-guide/",
  "ships_international": true,
  "accepts_wire_transfer": true,
  "accepts_paypal": true,
  "accepts_credit_card": false,
  "requires_deposit": true,
  "deposit_percentage": 30,
  "english_support": true,
  "notes": "Has English site. Responds to English emails."
}
```

## Validation

Before adding to database:
1. Verify email is valid format
2. Test that URLs are accessible
3. Cross-reference multiple sources if uncertain
4. Mark as `null` if information cannot be confirmed

## Update Frequency

- Initial research: One-time comprehensive review
- Updates: Quarterly review for policy changes
- Triggered updates: When user reports incorrect information

## Feature Behavior Without Data

If contact information is missing:
- `contact_email = null`: Show "Email not available - check dealer website" with link to domain
- Policy fields `= null`: Don't display those policy items
- Feature still works - user just needs to find email themselves
