import React from 'react';

/** "Seen 3 days ago · missed before" on a question card. Time and record only, never position. */
export const SeenBeforeChip: React.FC<{ label?: string | null }> = ({ label }) => {
  if (!label) return null;
  return <span data-testid="seen-before" className={`qf-seen-chip${/missed/.test(label) ? ' is-missed' : ''}`}>{label}</span>;
};
