'use client';

import React, { useMemo, memo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { GlossaryTerm } from './GlossaryTerm';
import { segmentText } from '@/lib/glossary/highlighter';

interface HighlightedMarkdownProps {
  content: string;
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
  p: ({ children, ...props }) => (
    <p {...props}>{highlightChildren(children)}</p>
  ),
  li: ({ children, ...props }) => (
    <li {...props}>{highlightChildren(children)}</li>
  ),
  strong: ({ children, ...props }) => (
    <strong {...props}>{highlightChildren(children)}</strong>
  ),
  em: ({ children, ...props }) => (
    <em {...props}>{highlightChildren(children)}</em>
  ),
  td: ({ children, ...props }) => (
    <td {...props}>{highlightChildren(children)}</td>
  ),
  th: ({ children, ...props }) => (
    <th {...props}>{highlightChildren(children)}</th>
  ),
  h1: ({ children, ...props }) => (
    <h1 {...props}>{highlightChildren(children)}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 {...props}>{highlightChildren(children)}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 {...props}>{highlightChildren(children)}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 {...props}>{highlightChildren(children)}</h4>
  ),
};

/**
 * HighlightedMarkdown component
 * Renders markdown with glossary term highlighting
 */
export function HighlightedMarkdown({ content }: HighlightedMarkdownProps) {
  return (
    <ReactMarkdown components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

export default HighlightedMarkdown;
