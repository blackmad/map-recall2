import { House, Map as MapIcon, Sailboat } from 'lucide-react';
import type { SiteLinks } from '../siteLinks';

export type SiteSurface = 'home' | 'ride' | 'quiz';

/**
 * Home / Ride / Quiz: the one way between the Map Recall surfaces that is
 * always reachable, not only mid-round. Styled by `.site-switch` in
 * src/theme/enamel-chrome.css, which both apps and the landing page load.
 */
export function SiteSwitch({ links, current, id }: { links: SiteLinks; current: SiteSurface; id?: string }) {
  const items: Array<{ key: SiteSurface; label: string; href: string; Icon: typeof House }> = [
    { key: 'home', label: 'Home', href: links.home, Icon: House },
    { key: 'ride', label: 'Ride', href: links.ride, Icon: Sailboat },
    { key: 'quiz', label: 'Quiz', href: links.quiz, Icon: MapIcon },
  ];
  return (
    <nav className="site-switch" id={id} aria-label="Map Recall">
      {items.map(({ key, label, href, Icon }) => (
        <a key={key} href={href} data-site={key} aria-current={key === current ? 'page' : undefined}>
          <Icon aria-hidden="true" strokeWidth={2.25} />
          {label}
        </a>
      ))}
    </nav>
  );
}
