import { useEffect, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../public/canal-drive/css/enamel.css';
import '../../public/canal-drive/css/landing-cards.css';
import landingPage from '../../public/canal-drive/landing.html?raw';
import { buildLandingModel, type LandingModel } from '../../src/canalRecall/landing/landingModel.ts';
import { mountWhatsNewToast, RETURNING_KEY } from '../../src/canalRecall/whatsNewToast.ts';
import { landingCardsHtml } from '../../src/canalRecall/landing/landingView.ts';
import {
  LANDING_FIXTURE_NOW,
  landingFixtureStorage,
  type LandingScenario,
} from '../../src/canalRecall/landing/landingFixtures.ts';

// The landing page for a returning player (G2, #272): Today's ride, Continue
// and Free Ride over the hero. The page's own <style> is lifted from
// landing.html so the cards sit in the same type and buttons as the page.
const pageStyle = (/<style>([\s\S]*?)<\/style>/.exec(landingPage)?.[1] ?? '');

type Variant = LandingScenario | 'long-names';

function modelFor(variant: Variant): LandingModel {
  const model = buildLandingModel(landingFixtureStorage(variant === 'long-names' ? 'returning' : variant), LANDING_FIXTURE_NOW);
  if (variant !== 'long-names' || !model.daily.pair) return model;
  return {
    ...model,
    header: { streakDays: 112, stamps: 37 },
    due: { names: 48, minutes: 30, nextDueDays: null },
    daily: {
      ...model.daily,
      pair: {
        ...model.daily.pair,
        from: { ...model.daily.pair.from, name: 'Gelderlandpleinbuurt' },
        to: { ...model.daily.pair.to, name: 'Prinses Irenebuurt e.o.' },
        km: 4.9,
      },
    },
  };
}

/** R2-11 (#304): the real toast, mounted against a stub window so it reads a fixed note and a returning flag. */
function useToast(on: boolean) {
  useEffect(() => {
    if (!on) return undefined;
    const store: Record<string, string> = { [RETURNING_KEY]: '1' };
    const fakeWin = {
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } },
      fetch: async (url: URL) => ({ ok: /notes/.test(String(url)), json: async () => ({ notes: [{ date: '2026-11-09', title: "Today's ride runs buurt to buurt; Continue names the streets you are due" }] }) }),
      location: window.location,
    } as unknown as Window;
    let toast: HTMLElement | null = null;
    void mountWhatsNewToast(document, fakeWin).then(el => { toast = el; });
    return () => { toast?.remove(); };
  }, [on]);
}

function LandingCards({ variant, toast = false }: { variant: Variant; toast?: boolean }) {
  useToast(toast);
  const html = useMemo(() => landingCardsHtml(modelFor(variant), { ride: '/ride' }), [variant]);
  return (
    <div className="landing-story">
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet" />
      <style>{pageStyle}</style>
      <header className="wrap top">
        <a className="wordmark enamel-plaque enamel-framed" href="#">Ride Amsterdam</a>
        <nav aria-label="Site"><a href="#">Quiz</a><a href="#">Progress</a><a href="#">Ride</a></nav>
      </header>
      <main>
        {html
          ? <div className="wrap" id="landing-returning-slot" dangerouslySetInnerHTML={{ __html: html }} />
          : null}
        <div className="wrap" style={{ paddingTop: 32 }}>
          <h1>Learn Amsterdam <em>by&nbsp;name</em></h1>
          <p className="lede">The static hero follows. A first-time visitor sees only this.</p>
        </div>
      </main>
    </div>
  );
}

const meta: Meta<typeof LandingCards> = {
  title: 'Canal Drive/Landing (returning player)',
  component: LandingCards,
  args: { variant: 'returning' },
  argTypes: {
    variant: { control: 'select', options: ['first-time', 'opened-once', 'returning', 'nothing-due', 'ridden-today', 'long-names'] },
  },
};
export default meta;
type Story = StoryObj<typeof LandingCards>;

const phone = { viewport: { defaultViewport: 'mobile2' } };

export const FirstTime: Story = { args: { variant: 'first-time' } };
export const Returning: Story = { args: { variant: 'returning' } };
export const RiddenToday: Story = { args: { variant: 'ridden-today' } };
export const NothingDue: Story = { args: { variant: 'nothing-due' } };
export const OpenedOnce: Story = { args: { variant: 'opened-once' } };
export const LongNames: Story = { args: { variant: 'long-names' } };
export const ReturningToast: Story = { args: { variant: 'returning', toast: true } };
export const ReturningToastPhone: Story = { args: { variant: 'returning', toast: true }, parameters: phone };
export const FirstTimePhone: Story = { args: { variant: 'first-time' }, parameters: phone };
export const ReturningPhone: Story = { args: { variant: 'returning' }, parameters: phone };
export const RiddenTodayPhone: Story = { args: { variant: 'ridden-today' }, parameters: phone };
export const NothingDuePhone: Story = { args: { variant: 'nothing-due' }, parameters: phone };
export const LongNamesPhone: Story = { args: { variant: 'long-names' }, parameters: phone };
