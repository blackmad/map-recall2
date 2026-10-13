// Styles for the riding prompt strip.
//
// `#canal-prompt` is a full-screen overlay that docks a 360 px card to one
// side; riding mode restyles the same card as a compact strip in the bottom
// band. The rules live here, injected once, so the legacy stylesheet in
// index.html does not grow; fold them into it when that file is next edited.
// Position comes from three custom properties the runtime sets from the HUD
// layout (`ridingPromptBand.ts`): --riding-left, --riding-bottom, --riding-width.

export const RIDING_PROMPT_STYLE_ID = 'canal-riding-prompt-styles';

export const RIDING_PROMPT_CSS = `
html #canal-prompt.riding, html #canal-prompt.riding.dock-left {
  inset: auto; left: var(--riding-left, 50%); bottom: var(--riding-bottom, 30px);
  width: var(--riding-width, 560px); padding: 0; background: none;
  align-items: flex-end; justify-content: stretch;
}
html #canal-prompt.riding #canal-card {
  width: 100%; max-height: none; overflow: visible; padding: 8px 10px 10px;
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px 10px;
}
#canal-prompt.riding .prompt-kind { grid-column: 1; grid-row: 1; margin: 0; padding: 3px 8px 3px 6px; font-size: 11px; }
#canal-prompt.riding #canal-card h2 { grid-column: 2; grid-row: 1; margin: 0; font-size: 14px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#canal-prompt.riding #canal-card p,
#canal-prompt.riding #canal-answer,
#canal-prompt.riding #canal-submit { display: none !important; }
#canal-prompt.riding #canal-no-idea { grid-column: 3; grid-row: 1; width: auto; margin: 0; min-height: 0; padding: 5px 9px; font-size: 12px; white-space: nowrap; }
#canal-prompt.riding #canal-feedback { grid-column: 1 / -1; grid-row: 2; margin: 0; font-size: 13px; }
/* On a narrow strip the question gets the room the kind chip took. */
#canal-prompt.riding.riding-narrow .prompt-kind { display: none; }
#canal-prompt.riding.riding-narrow #canal-card { grid-template-columns: minmax(0, 1fr) auto; }
#canal-prompt.riding.riding-narrow #canal-card h2 { grid-column: 1; }
#canal-prompt.riding.riding-narrow #canal-no-idea { grid-column: 2; }
#canal-prompt.riding #canal-choices { grid-column: 1 / -1; grid-row: 3; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 0; }
#canal-prompt.riding.riding-narrow #canal-choices { grid-template-columns: repeat(2, minmax(0, 1fr)); }
#canal-prompt.riding .canal-choice { min-width: 0; min-height: 38px; padding: 6px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
#canal-prompt.riding .canal-choice-key { flex: none; margin-right: 6px; }
#canal-prompt.riding #canal-card.answered #canal-choices { opacity: .9; }
`;

/** Add the stylesheet once. Safe to call on every prompt. */
export function installRidingPromptStyles(doc: Document = document): void {
  if (doc.getElementById(RIDING_PROMPT_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = RIDING_PROMPT_STYLE_ID;
  style.textContent = RIDING_PROMPT_CSS;
  doc.head.appendChild(style);
}
