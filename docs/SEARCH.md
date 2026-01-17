# Search Features Documentation

Nihontowatch provides powerful search capabilities for finding Japanese swords and fittings across all dealers.

## Quick Start

Type in the search box and press Enter. Examples:
- `juyo katana` - Juyo-certified katana
- `bizen cm>70` - Bizen school blades over 70cm
- `tokuju tsuba` - Tokubetsu Juyo tsuba

---

## Text Search

### Basic Search
Search terms are matched against multiple fields:
- `title` - Listing title
- `description` - Full description text
- `smith` / `tosogu_maker` - Artisan name
- `school` / `tosogu_school` - School/tradition
- `province` - Province of origin
- `era` - Time period
- `mei_type` - Signature type
- `cert_type` - Certification
- `item_type` - Item category
- `item_category` - Sub-category
- `material` - Material (for tosogu)

### Multi-Word Queries
Words are combined with AND logic:
- `bizen katana` → must match "bizen" AND "katana"
- `juyo wakizashi hozon` → must match all three terms

Each word can match in different fields:
- `juyo tsuba` → "juyo" in cert_type AND "tsuba" in item_type ✓

### Case Insensitive
All searches are case-insensitive:
- `Katana` = `katana` = `KATANA`

### Diacritics & Macrons
Macrons are normalized automatically:
- `Gotō` = `Goto` = `goto`
- `Tōkyō` = `Tokyo`

---

## Numeric Filters

Filter by measurements using comparison operators.

### Nagasa (Blade Length)
```
nagasa>70      # longer than 70cm
nagasa<65      # shorter than 65cm
nagasa>=72     # 72cm or longer
nagasa<=60     # 60cm or shorter
cm>70          # alias for nagasa>70
length>70      # alias for nagasa>70
```

### Price (JPY)
```
price>100000   # over ¥100,000
price<500000   # under ¥500,000
yen>100000     # alias for price
jpy<1000000    # alias for price
```

### Price (USD / EUR)
Filter by price in other currencies - automatically converts to JPY:
```
usd>20000      # over $20,000 (~¥3,000,000)
usd<5000       # under $5,000 (~¥750,000)
dollar>10000   # alias for usd
dollars>=5000  # alias for usd

eur>10000      # over €10,000 (~¥1,630,000)
eur<2000       # under €2,000 (~¥326,000)
euro>5000      # alias for eur
euros<=3000    # alias for eur
```

**Note:** Currency conversion uses approximate rates (USD ≈ 150 JPY, EUR ≈ 163 JPY). These are fallback rates for filtering - actual display prices use live exchange rates.

### Combined Examples
```
katana cm>70              # katana longer than 70cm
bizen nagasa>72 juyo      # Bizen Juyo blades over 72cm
wakizashi price<300000    # wakizashi under ¥300,000
juyo katana usd>20000     # Juyo katana over $20,000
tsuba eur<500             # Tsuba under €500
```

---

## Search Aliases

Common abbreviations and variants are automatically expanded.

### Certification Shortcuts
| Type | Expands To |
|------|------------|
| `tokuju` | tokubetsu juyo, tokubetsu_juyo |
| `tokuho` | tokubetsu hozon, tokubetsu_hozon |
| `tokukicho` | tokubetsu kicho, tokubetsu_kicho |
| `nbthk` | juyo, hozon, tokubetsu |

### Item Type Shortcuts
| Type | Expands To |
|------|------------|
| `waki` | wakizashi |
| `nagi` | naginata |
| `sword` / `blade` | katana, wakizashi, tanto, tachi |
| `tosogu` / `fitting` | tsuba, fuchi, kashira, menuki, kozuka |
| `fuchikashira` | fuchi_kashira, fuchi-kashira |

### Province Aliases
| Input | Also Matches |
|-------|--------------|
| `bizen` | bishu |
| `soshu` | sagami |
| `sagami` | soshu |
| `mino` | noshu |
| `seki` | mino |

### Era/Period Aliases
| Input | Also Matches |
|-------|--------------|
| `koto` | old sword |
| `shinto` | new sword |
| `shinshinto` | shin-shinto |
| `gendaito` | gendai, modern |
| `edo` | tokugawa |

### Mei (Signature) Aliases
| Input | Also Matches |
|-------|--------------|
| `mumei` | unsigned |
| `signed` | mei |
| `gimei` | false signature |

### Material Aliases (Tosogu)
| Input | Also Matches |
|-------|--------------|
| `iron` | tetsu |
| `gold` | kin |
| `silver` | gin |
| `copper` | akagane |

### Typo Corrections
| Input | Corrects To |
|-------|-------------|
| `tuba` | tsuba |
| `tanto` | tantou, tantō |

---

## URL Parameters

Search state is preserved in the URL for sharing/bookmarking.

### Query Parameters
| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Search query | `q=juyo+katana` |
| `tab` | available / sold | `tab=available` |
| `type` | Item types (comma-separated) | `type=katana,wakizashi` |
| `cert` | Certifications | `cert=Juyo,Hozon` |
| `dealer` | Dealer IDs | `dealer=1,5,12` |
| `sort` | Sort order | `sort=price_desc` |
| `page` | Page number | `page=2` |

### Sort Options
- `recent` - Newest first (default)
- `price_asc` - Price low to high
- `price_desc` - Price high to low
- `name` - Alphabetical by title

### Example URLs
```
/?q=juyo+katana&sort=price_desc
/?q=bizen+cm>70&tab=available
/?q=tokuju&type=tsuba&sort=price_asc
```

---

## Technical Implementation

### Text Normalization
1. Remove macrons (ō → o, ū → u)
2. Convert to lowercase
3. Unicode NFD normalization (remove diacritics)
4. Collapse whitespace
5. Trim

### Search Flow
1. Parse query string
2. Extract numeric filters (nagasa>70, price<500000)
3. Split remaining text into words
4. Expand each word with aliases
5. Build SQL OR conditions for each word across all fields
6. Combine with AND logic between words
7. Apply numeric filters
8. Execute query with pagination

### Database Fields Searched
```sql
title, description, smith, tosogu_maker, school, tosogu_school,
province, era, mei_type, cert_type, item_type, item_category, material
```

### Numeric Filter SQL
```sql
-- nagasa>70 becomes:
WHERE nagasa_cm > 70

-- price<500000 becomes:
WHERE price_value < 500000
```

---

## Examples by Use Case

### Finding a Specific Type
```
katana                    # All katana
wakizashi                 # All wakizashi
tsuba                     # All tsuba
tanto                     # All tanto
```

### By Certification
```
juyo                      # All Juyo items
tokuju                    # Tokubetsu Juyo
hozon                     # Hozon papers
tokuho                    # Tokubetsu Hozon
```

### By School/Province
```
bizen                     # Bizen school
soshu                     # Soshu/Sagami
yamashiro                 # Yamashiro
mino                      # Mino/Seki
```

### By Era
```
koto                      # Old swords (pre-1596)
shinto                    # New swords (1596-1780)
shinshinto                # New-new swords (1781-1876)
gendaito                  # Modern swords (1876+)
```

### By Physical Characteristics
```
katana cm>70              # Long katana
wakizashi nagasa<45       # Short wakizashi
mumei katana              # Unsigned katana
```

### Combined Searches
```
bizen juyo katana cm>70   # Bizen Juyo katana, 70cm+
soshu tanto hozon         # Soshu tanto with Hozon
mumei wakizashi koto      # Unsigned Koto wakizashi
iron tsuba edo            # Iron tsuba from Edo period
```

### Price Filtering
```
katana price<500000       # Katana under ¥500,000
juyo price>1000000        # Juyo items over ¥1,000,000
tsuba yen<100000          # Budget tsuba
```
