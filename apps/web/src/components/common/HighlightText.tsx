import React from 'react';

interface HighlightTextProps {
  text?: string | null;
  query?: string;
  className?: string;
  highlightClassName?: string;
}

export function HighlightText({
  text,
  query,
  className,
  highlightClassName = 'bg-amber-200/90 dark:bg-amber-800/80 text-foreground px-0.5 rounded font-bold transition-colors shadow-sm',
}: HighlightTextProps) {
  if (!text) return null;
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const trimmedQuery = query.trim();
  const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  try {
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <span className={className}>
        {parts.map((part, index) =>
          part.toLowerCase() === trimmedQuery.toLowerCase() ? (
            <mark key={index} className={highlightClassName}>
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  } catch {
    return <span className={className}>{text}</span>;
  }
}
