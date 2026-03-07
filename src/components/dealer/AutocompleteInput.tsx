'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface Suggestion {
  name: string;
  name_ja: string | null;
  category: string | null;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (name: string, name_ja: string | null) => void;
  fetchUrl: string; // e.g. '/api/dealer/suggestions?type=provenance'
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 300;

export function AutocompleteInput({ value, onChange, fetchUrl, placeholder, className }: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${fetchUrl}&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.results || []);
        setShowDropdown((data.results || []).length > 0);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [fetchUrl]);

  const handleInputChange = useCallback((text: string) => {
    onChange(text, null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, DEBOUNCE_MS);
  }, [onChange, fetchSuggestions]);

  const handleSelect = useCallback((suggestion: Suggestion) => {
    onChange(suggestion.name, suggestion.name_ja);
    setShowDropdown(false);
    setSuggestions([]);
  }, [onChange]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        placeholder={placeholder}
        className={className || 'w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-accent'}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="w-3 h-3 border-2 border-muted border-t-transparent rounded-full animate-spin inline-block" />
        </div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border/50 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-hover transition-colors flex items-center justify-between gap-2"
            >
              <span className="truncate">{s.name}</span>
              {s.name_ja && (
                <span className="text-[11px] text-muted flex-shrink-0">{s.name_ja}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
