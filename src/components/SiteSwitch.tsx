import { Building2, House, Map as MapIcon, Route, Sailboat } from 'lucide-react';
import type { SiteLinks } from '../siteLinks';
import { useT } from '../i18n/useT';

export type SiteSurface = 'home' | 'ride' | 'quiz' | 'progress' | 'explore';

/**
 * Home / Ride / Quiz / Progress / Buildings: the one way between the Map Recall surfaces that is
 * always reachable, not only mid-round. Styled by `.site-switch` in
 * src/theme/enamel-chrome.css, which both apps and the landing page load.
 */
export function SiteSwitch({ links, current, id }: { links: SiteLinks; current: SiteSurface; id?: string }) {
  const t = useT();
  const items: Array<{ key: SiteSurface; label: string; href: string; Icon: typeof House }> = [
    { key: 'home', label: t('site.home'), href: links.home, Icon: House },
    { key: 'ride', label: t('site.ride'), href: links.ride, Icon: Sailboat },
    { key: 'quiz', label: t('site.quiz'), href: links.quiz, Icon: MapIcon },
    { key: 'progress', label: t('site.progress'), href: links.progress, Icon: Route },
    { key: 'explore', label: t('site.buildings'), href: links.explore, Icon: Building2 },
  ];
  return (
    <nav className="site-switch" id={id} aria-label="Ride Amsterdam">
      {items.map(({ key, label, href, Icon }) => (
        <a key={key} href={href} data-site={key} aria-current={key === current ? 'page' : undefined}>
          <Icon aria-hidden="true" strokeWidth={2.25} />
          {label}
        </a>
      ))}
    </nav>
  );
}
