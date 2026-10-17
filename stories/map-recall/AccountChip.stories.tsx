import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../src/index.css';
import { AccountChip, type AccountChipUser } from '../../src/components/AccountChip';

/**
 * The one account control (2026-10-17): Sign in for a guest; signed in, an
 * avatar (or a copper initial when there is no photo, or it fails to load)
 * that opens My progress / Sign out. Shared by the ride's setup rail, the
 * Map Quest header and My progress.
 */
const Frame: React.FC<{ user: AccountChipUser | null; open?: boolean; compact?: boolean; width: number }> = ({ user, open, compact, width }) =>
  <div id="root" style={{ minHeight: '100vh', background: '#f4efe5', padding: 16, boxSizing: 'border-box' }}>
    <div style={{ width, maxWidth: '100%', display: 'flex', justifyContent: 'flex-end', paddingBottom: 220, borderBottom: '1px solid rgba(31,28,23,.14)' }}>
      <AccountChip user={user} compact={compact} defaultOpen={open} onSignIn={() => {}} onSignOut={() => {}} progressHref="#progress" />
    </div>
  </div>;

const meta = { title: 'Map Recall/Account chip', component: Frame } satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;
const phone = { viewport: { value: 'mobile2', isRotated: false } };
const anna: AccountChipUser = { label: 'Anna van der Berg-Oosterhout', email: 'anna.vanderberg-oosterhout@example.org', photoURL: null };

export const GuestDesktop: Story = { args: { user: null, width: 968 } };
export const GuestCompactPhone: Story = { args: { user: null, compact: true, width: 358 }, globals: phone };
export const SignedInInitialDesktop: Story = { args: { user: anna, width: 968 } };
export const SignedInMenuDesktop: Story = { args: { user: anna, open: true, width: 968 } };
export const SignedInMenuPhone: Story = { args: { user: anna, open: true, width: 358 }, globals: phone };
export const MissingPhotoFallsBackToInitial: Story = { args: { user: { ...anna, photoURL: '/missing-avatar.png' }, open: true, width: 358 }, globals: phone };
