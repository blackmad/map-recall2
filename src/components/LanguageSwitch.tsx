/**
 * The language switch both sites use.
 *
 * The ride draws it as the same paper tile pair as its other choices; the quiz
 * header has no tiles, so `compact` renders a two-button enamel chip. Both read
 * and write the same store, so switching on one page is not undone by the
 * other.
 */

import { LANGUAGES, setLanguage, type Language } from '../i18n/index.ts';
import { useLanguage, useT } from '../i18n/useT.ts';

export function LanguageSwitch({ compact = false, idPrefix = 'language' }: { compact?: boolean; idPrefix?: string }) {
  const t = useT();
  const active = useLanguage();
  if (compact) {
    return (
      <div className="enamel-segment flex items-center gap-0.5" role="radiogroup" aria-label={t('language.label')}>
        {LANGUAGES.map((code) => {
          const name = t(code === 'nl' ? 'language.nl' : 'language.en');
          return (
            <button
              key={code}
              id={`${idPrefix}-${code}`}
              type="button"
              role="radio"
              aria-checked={active === code}
              aria-label={name}
              title={name}
              lang={code}
              onClick={() => setLanguage(code as Language)}
              className={`px-1.5 py-1 text-xs font-bold cursor-pointer${active === code ? ' active' : ''}`}
            >
              {t(code === 'nl' ? 'language.nlShort' : 'language.enShort')}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="setup-choice-row toggles language-row" role="radiogroup" aria-label={t('language.label')}>
      <div className="setup-choice-label"><span>{t('language.label')}</span></div>
      <div className="setup-choice-options">
        {LANGUAGES.map((code) => {
          const name = t(code === 'nl' ? 'language.nl' : 'language.en');
          return (
            <button
              key={code}
              id={`${idPrefix}-${code}`}
              type="button"
              className={`setup-choice enamel-tile${active === code ? ' active' : ''}`}
              aria-pressed={active === code}
              aria-label={name}
              title={name}
              lang={code}
              onClick={() => setLanguage(code as Language)}
            >
              <span className="setup-choice-text">
                <strong>{t(code === 'nl' ? 'language.nlShort' : 'language.enShort')}</strong>
                <small>{name}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
