import { useEffect } from 'react';

import { useStack } from '../lib/useStack';
import { TabStack } from '../navigation/TabStack';
import FriendsScreen from './FriendsScreen';
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
  friends: 'Your code, and who you train alongside',
  settings: 'Account, reminders and sync',
  privacy: 'What this app knows about you',
};

export default function ProfileScreen({
  bottomInset,
  pendingFriendCode,
  onFriendCodeUsed,
}: {
  bottomInset: number;
  /** A code from a shared link, handed down by the shell. */
  pendingFriendCode?: string;
  onFriendCodeUsed?: () => void;
}) {
  const stack = useStack<View>({ key: 'profile' });
  const view = stack.current;

  // A shared link should land on Friends with the code in the box, not on the
  // profile root with the reason for opening the app already forgotten.
  useEffect(() => {
    if (pendingFriendCode && view.key !== 'friends') stack.push({ key: 'friends' });
  }, [pendingFriendCode, stack, view.key]);

  return (
    <TabStack
      stack={stack}
      title={TITLES[view.key]}
      meta={METAS[view.key]}
      backLabel="Back to your profile"
    >
      {view.key === 'friends' ? (
        <FriendsScreen
          bottomInset={bottomInset}
          pendingCode={pendingFriendCode}
          onCodeUsed={onFriendCodeUsed}
        />
      ) : view.key === 'progress' ? (
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
