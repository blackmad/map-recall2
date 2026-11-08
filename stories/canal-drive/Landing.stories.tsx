import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../public/canal-drive/css/enamel.css';
import '../../public/canal-drive/css/landing-cards.css';
import landingPage from '../../public/canal-drive/landing.html?raw';
import { buildLandingModel, type LandingModel } from '../../src/canalRecall/landing/landingModel.ts';
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
        from: { ...model.daily.pair.from, name: 'Nationaal Monument op de Dam' },
        to: { ...model.daily.pair.to, name: 'Stedelijk Museum Amsterdam (Museumplein)' },
        km: 4.1,
      },
    },
  };
}

function LandingCards({ variant }: { variant: Variant }) {
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
export const FirstTimePhone: Story = { args: { variant: 'first-time' }, parameters: phone };
export const ReturningPhone: Story = { args: { variant: 'returning' }, parameters: phone };
export const RiddenTodayPhone: Story = { args: { variant: 'ridden-today' }, parameters: phone };
export const NothingDuePhone: Story = { args: { variant: 'nothing-due' }, parameters: phone };
export const LongNamesPhone: Story = { args: { variant: 'long-names' }, parameters: phone };
