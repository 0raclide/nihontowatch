'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableTextProps {
  value: string | null;
  onSave: (newValue: string | null) => Promise<void>;
  className?: string;
  placeholder?: string;
  children?: React.ReactNode;
}

export function EditableText({ value, onSave, className, placeholder, children }: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? '');
    }
  }, [value, isEditing]);

  // Auto-focus and auto-resize on enter edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [isEditing]);

  // Auto-resize on content change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  }, []);

  const commitSave = useCallback(async () => {
    const trimmed = draft.trim();
    const newValue = trimmed || null;
    if (newValue === (value ?? null)) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch {
      // Revert on failure — keep editing so user can retry
      setDraft(value ?? '');
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value ?? '');
      setIsEditing(false);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commitSave();
    }
  }, [value, commitSave]);

  const handleBlur = useCallback(() => {
    commitSave();
  }, [commitSave]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isSaving}
        placeholder={placeholder}
        className={`${className ?? ''} w-full resize-none bg-transparent border border-gold/30 rounded px-1.5 py-1 focus:outline-none focus:border-gold/60 ${isSaving ? 'opacity-60' : ''}`}
        rows={1}
      />
    );
  }

  return (
    <div
      className="group/editable relative cursor-pointer"
      onClick={() => setIsEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsEditing(true); }}
    >
      {children || (value ? (
        <p className={className}>{value}</p>
      ) : placeholder ? (
        <p className={`${className ?? ''} text-muted/50 italic`}>{placeholder}</p>
      ) : null)}

      {/* Pen icon — visible on hover/focus */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        className="absolute top-0 right-0 p-1 opacity-0 group-hover/editable:opacity-100 focus:opacity-100 transition-opacity text-muted hover:text-gold"
        aria-label="Edit"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
}
