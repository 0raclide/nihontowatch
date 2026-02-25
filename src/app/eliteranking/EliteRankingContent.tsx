'use client';

import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/* ─── Heading ID generation for anchor links ─────────────────────────── */

function slugify(node: React.ReactNode): string {
  if (typeof node === 'string') return node.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (Array.isArray(node)) return node.map(slugify).filter(Boolean).join('-');
  return '';
}

/* ─── Custom components ──────────────────────────────────────────────── */

const components: Components = {
  // h2 with auto-generated IDs for anchor links
  h2: ({ children }) => <h2 id={slugify(children)}>{children}</h2>,
  // Wrap tables in a scrollable container for mobile
  table: ({ children }) => (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table>{children}</table>
    </div>
  ),
};

/* ─── Component ──────────────────────────────────────────────────────── */

interface EliteRankingContentProps {
  content: string;
}

export function EliteRankingContent({ content }: EliteRankingContentProps) {
  return (
    <article className="prose-methodology">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
