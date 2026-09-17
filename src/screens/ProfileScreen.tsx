import { useStack } from '../lib/useStack';
import { TabStack } from '../navigation/TabStack';
import PrivacyScreen from './PrivacyScreen';
import ProfileHomeScreen from './ProfileHomeScreen';
import ProgressScreen from './ProgressScreen';
import SettingsScreen from './SettingsScreen';

/**
 * The Profile tab: you, and everything that belongs to your account.
 *
 * Progress, settings and privacy were three separate destinations reached
 * through a slide-out menu. They are all answers to "what about me", so they
 * are one tab with depth — which is how the menu came to be removable.
 */
type View =
  | { key: 'profile' }
  | { key: 'progress' }
  | { key: 'friends' }
  | { key: 'settings' }
  | { key: 'privacy' };

const TITLES: Record<View['key'], string | null> = {
  profile: null,
  progress: 'Progress',
  friends: 'Friends',
  settings: 'Settings',
  privacy: 'Privacy',
};

const METAS: Record<View['key'], string | undefined> = {
  profile: undefined,
  progress: 'Streaks, history and achievements',
  friends: 'People you train alongside',
  settings: 'Account, reminders and sync',
  privacy: 'What this app knows about you',
};

export default function ProfileScreen({ bottomInset }: { bottomInset: number }) {
  const stack = useStack<View>({ key: 'profile' });
  const view = stack.current;

  return (
    <TabStack
      stack={stack}
      title={TITLES[view.key]}
      meta={METAS[view.key]}
      backLabel="Back to your profile"
    >
      {view.key === 'progress' || view.key === 'friends' ? (
        // Friends lands here until the next stage builds it, so the row leads
        // somewhere real rather than to an empty screen.
        <ProgressScreen bottomInset={bottomInset} />
      ) : view.key === 'settings' ? (
        <SettingsScreen
          bottomInset={bottomInset}
          onOpenPrivacy={() => stack.push({ key: 'privacy' })}
        />
      ) : view.key === 'privacy' ? (
        <PrivacyScreen bottomInset={bottomInset} />
      ) : (
        <ProfileHomeScreen bottomInset={bottomInset} onOpen={(key) => stack.push({ key })} />
      )}
    </TabStack>
  );
}
