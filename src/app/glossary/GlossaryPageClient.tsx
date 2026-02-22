'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { getAllTerms, getCategories, CATEGORY_LABELS } from '@/lib/glossary';
import type { GlossaryEntry, GlossaryCategory } from '@/lib/glossary/types';
import { useLocale } from '@/i18n/LocaleContext';

// Generate alphabet array A-Z
const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export function GlossaryPageClient() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GlossaryCategory | 'all'>(
    'all'
  );
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get all terms and categories
  const allTerms = useMemo(() => getAllTerms(), []);
  const categories = useMemo(() => getCategories(), []);

  // Filter terms based on search and category
  const filteredTerms = useMemo(() => {
    let terms = allTerms;

    // Filter by category
    if (selectedCategory !== 'all') {
      terms = terms.filter((t) => t.category === selectedCategory);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      terms = terms.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.romaji.toLowerCase().includes(q) ||
          (t.kanji && t.kanji.includes(q)) ||
          t.definition.toLowerCase().includes(q)
      );
    }

    // Sort alphabetically
    return terms.sort((a, b) => a.term.localeCompare(b.term));
  }, [allTerms, search, selectedCategory]);

  // Group terms by first letter
  const termsByLetter = useMemo(() => {
    const groups: Record<string, GlossaryEntry[]> = {};
    for (const term of filteredTerms) {
      const letter = term.term[0].toUpperCase();
      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(term);
    }
    return groups;
  }, [filteredTerms]);

  // Available letters (those with terms)
  const availableLetters = useMemo(
    () => ALPHABET.filter((letter) => termsByLetter[letter]?.length > 0),
    [termsByLetter]
  );

  // Scroll to letter section
  const scrollToLetter = (letter: string) => {
    const element = document.getElementById(`letter-${letter}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Focus search on keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 lg:px-6 lg:py-8">
      {/* Search and Filters */}
      <div className="sticky top-0 z-10 bg-cream pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6 border-b border-border mb-6">
        {/* Search */}
        <div className="relative mb-4">
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('glossary.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-lg text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/10 transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-medium text-muted/40 bg-linen rounded">
            /
          </kbd>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              selectedCategory === 'all'
                ? 'bg-gold text-white'
                : 'bg-surface border border-border text-muted hover:text-ink hover:border-gold/30'
            }`}
          >
            {t('glossary.all', { count: String(allTerms.length) })}
          </button>
          {(Object.keys(categories) as GlossaryCategory[]).map((cat) => {
            const count = allTerms.filter((t) => t.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  selectedCategory === cat
                    ? 'bg-gold text-white'
                    : 'bg-surface border border-border text-muted hover:text-ink hover:border-gold/30'
                }`}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Alphabet Index */}
      {!search && (
        <div className="flex flex-wrap gap-1 mb-6 justify-center">
          {ALPHABET.map((letter) => {
            const hasTerms = availableLetters.includes(letter);
            return (
              <button
                key={letter}
                onClick={() => hasTerms && scrollToLetter(letter)}
                disabled={!hasTerms}
                className={`w-8 h-8 text-xs font-medium rounded transition-colors ${
                  hasTerms
                    ? 'bg-surface border border-border text-ink hover:bg-gold hover:text-white hover:border-gold'
                    : 'text-muted/30 cursor-not-allowed'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted mb-4">
        {filteredTerms.length === allTerms.length
          ? t('glossary.terms', { count: filteredTerms.length.toLocaleString() })
          : t('glossary.termsFiltered', { filtered: filteredTerms.length.toLocaleString(), total: allTerms.length.toLocaleString() })}
      </p>

      {/* Terms list */}
      {filteredTerms.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted">{t('glossary.noResults')}</p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('all');
            }}
            className="mt-2 text-sm text-gold hover:text-gold-light transition-colors"
          >
            {t('glossary.clearFilters')}
          </button>
        </div>
      ) : search ? (
        // Search results - flat list
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTerms.map((term) => (
            <TermCard
              key={term.romaji}
              term={term}
              isExpanded={expandedTerm === term.romaji}
              onToggle={() =>
                setExpandedTerm(expandedTerm === term.romaji ? null : term.romaji)
              }
            />
          ))}
        </div>
      ) : (
        // Alphabetical sections
        <div className="space-y-8">
          {availableLetters.map((letter) => (
            <section key={letter} id={`letter-${letter}`} className="scroll-mt-40">
              <h2 className="text-2xl font-serif text-ink mb-4 pb-2 border-b border-border">
                {letter}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {termsByLetter[letter].map((term) => (
                  <TermCard
                    key={term.romaji}
                    term={term}
                    isExpanded={expandedTerm === term.romaji}
                    onToggle={() =>
                      setExpandedTerm(expandedTerm === term.romaji ? null : term.romaji)
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// Individual term card component
function TermCard({
  term,
  isExpanded,
  onToggle,
}: {
  term: GlossaryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`bg-surface border rounded-lg transition-all ${
        isExpanded ? 'border-gold shadow-md' : 'border-border hover:border-gold/30'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4"
        aria-expanded={isExpanded}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-ink">{term.term}</span>
          {term.kanji && (
            <span className="text-sm text-gold font-jp shrink-0">{term.kanji}</span>
          )}
        </div>
        {isExpanded && (
          <div className="mt-3 animate-fadeIn">
            <p className="text-sm text-ink/80 leading-relaxed">{term.definition}</p>
            <div className="mt-2 pt-2 border-t border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted">
                {CATEGORY_LABELS[term.category]}
              </span>
            </div>
          </div>
        )}
        {!isExpanded && (
          <p className="text-xs text-muted mt-1 line-clamp-1">{term.definition}</p>
        )}
      </button>
    </div>
  );
}
