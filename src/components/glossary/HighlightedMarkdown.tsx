'use client';

import React, { useMemo, memo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { GlossaryTerm } from './GlossaryTerm';
import { segmentText } from '@/lib/glossary/highlighter';

interface HighlightedMarkdownProps {
  content: string;
  /** Variant for different styling contexts */
  variant?: 'default' | 'translation';
}

/**
 * Render highlighted text from segments
 * Memoized to prevent unnecessary re-renders
 */
const HighlightedText = memo(function HighlightedText({ text }: { text: string }) {
  const segments = useMemo(() => segmentText(text), [text]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <React.Fragment key={i}>{seg.content}</React.Fragment>
        ) : (
          <GlossaryTerm key={i} entry={seg.entry}>
            {seg.content}
          </GlossaryTerm>
        )
      )}
    </>
  );
});

/**
 * Recursively process children, highlighting string nodes
 * Preserves React elements while wrapping text in highlights
 */
function highlightChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, index) => {
    // If it's a string, apply highlighting
    if (typeof child === 'string') {
      return <HighlightedText key={index} text={child} />;
    }

    // If it's a valid React element with children, recurse
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(child, {
        ...child.props,
        key: index,
        children: highlightChildren(child.props.children),
      } as React.Attributes & { children?: React.ReactNode });
    }

    // Otherwise return as-is (numbers, null, undefined, etc.)
    return child;
  });
}

/**
 * Custom components for ReactMarkdown that apply glossary highlighting
 * Defined outside component to ensure stable reference
 */
const markdownComponents: Components = {
  p: ({ children }) => (
    <p>{highlightChildren(children)}</p>
  ),
  li: ({ children }) => (
    <li>{highlightChildren(children)}</li>
  ),
  strong: ({ children }) => (
    <strong>{highlightChildren(children)}</strong>
  ),
  em: ({ children }) => (
    <em>{highlightChildren(children)}</em>
  ),
  td: ({ children }) => (
    <td>{highlightChildren(children)}</td>
  ),
  th: ({ children }) => (
    <th>{highlightChildren(children)}</th>
  ),
  h1: ({ children }) => (
    <h1>{highlightChildren(children)}</h1>
  ),
  h2: ({ children }) => (
    <h2>{highlightChildren(children)}</h2>
  ),
  h3: ({ children }) => (
    <h3>{highlightChildren(children)}</h3>
  ),
  h4: ({ children }) => (
    <h4>{highlightChildren(children)}</h4>
  ),
};

/**
 * Styled components for translation variant
 * Uses scholarly typography matching oshi-v2
 * CSS classes defined in globals.css (.prose-translation)
 */
const translationComponents: Components = {
  // Title header with underline
  h1: ({ children }) => (
    <h1 className="text-base font-medium text-ink mt-0 mb-4 pb-2 border-b border-border">
      {highlightChildren(children)}
    </h1>
  ),
  // Section headers with generous top margin
  h2: ({ children }) => (
    <h2 className="text-[14px] font-medium text-ink mt-7 mb-3">
      {highlightChildren(children)}
    </h2>
  ),
  // Subsection headers
  h3: ({ children }) => (
    <h3 className="text-[13px] font-medium text-ink mt-5 mb-2">
      {highlightChildren(children)}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-[13px] font-medium text-ink mt-4 mb-2">
      {highlightChildren(children)}
    </h4>
  ),
  // Paragraphs with generous spacing
  p: ({ children }) => (
    <p className="mb-5 last:mb-0">
      {highlightChildren(children)}
    </p>
  ),
  // Bold text - primary color for emphasis
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">
      {highlightChildren(children)}
    </strong>
  ),
  // Italics - keep subtle
  em: ({ children }) => (
    <em>{highlightChildren(children)}</em>
  ),
  // Line breaks as vertical spacers (like oshi-v2)
  br: () => <span className="block h-3" />,
  // Lists with proper spacing
  ul: ({ children }) => (
    <ul className="my-4 pl-5 space-y-2 list-disc list-outside marker:text-muted">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 pl-5 space-y-2 list-decimal list-outside marker:text-muted">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li>{highlightChildren(children)}</li>
  ),
  // Blockquotes with gold accent
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gold pl-4 my-4 text-muted italic">
      {children}
    </blockquote>
  ),
  // Horizontal rules
  hr: () => <hr className="my-6 border-border" />,
  // Tables
  table: ({ children }) => (
    <table className="w-full border-collapse text-[13px] my-4">
      {children}
    </table>
  ),
  th: ({ children }) => (
    <th className="border border-border px-3 py-2 bg-surface-elevated font-medium text-ink text-left">
      {highlightChildren(children)}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-2">
      {highlightChildren(children)}
    </td>
  ),
  // Links
  a: ({ children, href }) => (
    <a href={href} className="text-gold hover:text-gold-light hover:underline">
      {highlightChildren(children)}
    </a>
  ),
};

/**
 * HighlightedMarkdown component
 * Renders markdown with glossary term highlighting
 *
 * @param content - Markdown content to render
 * @param variant - 'default' uses minimal styling, 'translation' uses scholarly typography
 */
export function HighlightedMarkdown({ content, variant = 'default' }: HighlightedMarkdownProps) {
  const components = variant === 'translation' ? translationComponents : markdownComponents;

  return (
    <ReactMarkdown components={components}>
      {content}
    </ReactMarkdown>
  );
}

export default HighlightedMarkdown;
