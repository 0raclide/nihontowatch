# Setsumei Markdown Formatting Improvements

## Current State

The setsumei content in nihontowatch uses basic Tailwind prose classes applied to a wrapper div:

```tsx
<div className="prose prose-sm prose-invert max-w-none text-ink/80
  prose-headings:text-ink prose-headings:font-medium prose-headings:mb-2 prose-headings:mt-4
  prose-h2:text-[15px] prose-h3:text-[13px]
  prose-p:text-[13px] prose-p:leading-relaxed prose-p:mb-3
  ...
">
  <HighlightedMarkdown content={...} />
</div>
```

This approach is functional but lacks the scholarly elegance of oshi-v2's implementation.

## What oshi-v2 Does Better

1. **Custom Markdown Components** - Module-level styled components prevent remounts and provide fine-grained control
2. **Serif Typography** - Uses EB Garamond for a scholarly appearance
3. **Dedicated `.prose-translation` CSS** - Custom typography with 14.5px font, 1.85 line-height
4. **Better Spacing** - Generous paragraph margins (mb-5), section header spacing (mt-7)
5. **Visual Hierarchy** - Clear distinction between h1 (title), h2 (section), h3 (subsection)
6. **First Paragraph Styling** - Slightly larger (15px) first paragraph for emphasis
7. **Line Breaks as Spacers** - `<br>` renders as `h-3` spacing blocks for field separation
8. **GlossaryTerm on Italics** - `*term*` becomes an interactive tooltip

## Implementation Plan

### Phase 1: Add `.prose-translation` CSS Class

**File:** `src/app/globals.css`

Add a dedicated CSS class for setsumei/translation content:

```css
/* Translation prose styling - scholarly elegance */
.prose-translation {
  font-family: var(--font-serif), Georgia, serif;
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--text-secondary);
  letter-spacing: 0.01em;
}

.prose-translation > p:first-of-type {
  font-size: 15px;
}

/* Headings in translation content */
.prose-translation h1 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin-top: 0;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.prose-translation h2 {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-top: 1.75rem;
  margin-bottom: 0.75rem;
}

.prose-translation h3 {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

.prose-translation p {
  margin-bottom: 1.25rem;
}

.prose-translation ul {
  margin: 1rem 0;
  padding-left: 1.25rem;
}

.prose-translation li {
  margin: 0.5rem 0;
}

.prose-translation strong {
  font-weight: 600;
  color: var(--text-primary);
}

.prose-translation blockquote {
  border-left: 2px solid var(--accent);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--text-muted);
  font-style: italic;
}

.prose-translation hr {
  margin: 1.5rem 0;
  border-color: var(--border);
}

/* Tables in translation */
.prose-translation table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 1rem 0;
}

.prose-translation th,
.prose-translation td {
  border: 1px solid var(--border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.prose-translation th {
  background: var(--surface-elevated);
  font-weight: 500;
}
```

### Phase 2: Update HighlightedMarkdown with Styled Components

**File:** `src/components/glossary/HighlightedMarkdown.tsx`

Create a variant that applies beautiful styling:

```tsx
// Add a variant prop for translation context
interface HighlightedMarkdownProps {
  content: string;
  variant?: 'default' | 'translation';
}

// Styled components for translation variant
const translationComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-medium text-ink mt-0 mb-4 pb-2 border-b border-border">
      {highlightChildren(children)}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[13px] font-medium text-ink mt-7 mb-3">
      {highlightChildren(children)}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-medium text-ink mt-5 mb-2">
      {highlightChildren(children)}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-5 text-ink/80">
      {highlightChildren(children)}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">
      {highlightChildren(children)}
    </strong>
  ),
  br: () => <span className="block h-3" />,
  ul: ({ children }) => (
    <ul className="my-4 pl-5 space-y-2 list-disc list-outside marker:text-muted">
      {children}
    </ul>
  ),
  li: ({ children }) => (
    <li className="text-ink/80">{highlightChildren(children)}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gold pl-4 my-4 text-muted italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  // ... table components
};
```

### Phase 3: Update SetsumeiSection to Use New Styling

**File:** `src/components/listing/SetsumeiSection.tsx`

Replace the current prose classes with the new approach:

```tsx
// Before
<div className="prose prose-sm prose-invert max-w-none text-ink/80 ...">
  <HighlightedMarkdown content={visibleText || ''} />
</div>

// After
<article className="prose-translation">
  <HighlightedMarkdown content={visibleText || ''} variant="translation" />
</article>
```

### Phase 4: Update StudySetsumeiView

**File:** `src/components/listing/StudySetsumeiView.tsx`

Apply the same elegant styling to the study mode view, with slightly larger fonts for the dedicated reading experience.

### Phase 5: Add "Official Translation" Visual Distinction

For Yuhinkai translations, add subtle visual cues:

1. Gold-tinted left border on the container
2. "Verified by Yuhinkai" badge near the source attribution
3. Slightly warmer background tint (`bg-gold/5`)

## Visual Comparison

| Element | Current | Proposed |
|---------|---------|----------|
| Font | System sans | Serif (--font-serif) |
| Size | 13px | 14.5px (15px first para) |
| Line height | 1.5 | 1.85 |
| Paragraph margin | 0.75rem | 1.25rem |
| H2 top margin | 1rem | 1.75rem |
| Background | Generic | Gold-tinted for Yuhinkai |

## Files to Modify

1. `src/app/globals.css` - Add `.prose-translation` styles
2. `src/components/glossary/HighlightedMarkdown.tsx` - Add `variant` prop with styled components
3. `src/components/listing/SetsumeiSection.tsx` - Use new `prose-translation` class
4. `src/components/listing/StudySetsumeiView.tsx` - Use new styling
5. `src/components/listing/YuhinkaiEnrichmentSection.tsx` - Align styling (if used)

## Testing Checklist

- [ ] Verify prose-translation class applies correctly in light mode
- [ ] Verify prose-translation class applies correctly in dark mode
- [ ] Check SetsumeiSection renders properly for OCR content
- [ ] Check SetsumeiSection renders properly for Yuhinkai content
- [ ] Check StudySetsumeiView renders properly
- [ ] Verify GlossaryTerm tooltips still work
- [ ] Test truncation/expand behavior in preview mode
- [ ] Test Japanese text display (font-jp class)
- [ ] Mobile responsive testing
