import { useStack } from '../lib/useStack';
import { TabStack } from '../navigation/TabStack';
import GoalsScreen from './GoalsScreen';
import TodayScreen from './TodayScreen';
import VictoriesScreen from './VictoriesScreen';

/**
 * The Home tab: today, and the two screens you reach from it.
 *
 * Victories and Goals used to be tabs of their own. They are not places you
 * navigate to so much as parts of today you occasionally open in full, so they
 * sit one level under it — which is also what frees the tab bar down to five.
 */
type View = { key: 'today' } | { key: 'victories' } | { key: 'goals' };

const TITLES: Record<View['key'], string | null> = {
  today: null,
  victories: '3 Victories',
  goals: 'Daily goals',
};

const METAS: Record<View['key'], string | undefined> = {
  today: undefined,
  victories: 'Body, mind and spirit',
  goals: 'Targets and reminders',
};

export default function HomeScreen({
  bottomInset,
  onOpenTimer,
  onOpenFriends,
}: {
  bottomInset: number;
  /** The timer is a tab, not a drill-down; the shell handles the switch. */
  onOpenTimer: () => void;
  /** Friends lives under the You tab, so this is a tab switch too. */
  onOpenFriends: () => void;
}) {
  const stack = useStack<View>({ key: 'today' });
  const view = stack.current;

  return (
    <TabStack
      stack={stack}
      title={TITLES[view.key]}
      meta={METAS[view.key]}
      backLabel="Back to today"
    >
      {view.key === 'victories' ? (
        <VictoriesScreen bottomInset={bottomInset} />
      ) : view.key === 'goals' ? (
        <GoalsScreen bottomInset={bottomInset} />
      ) : (
        <TodayScreen
          bottomInset={bottomInset}
          onOpenGoals={() => stack.push({ key: 'goals' })}
          onOpenVictories={() => stack.push({ key: 'victories' })}
          onOpenTimer={onOpenTimer}
          onOpenFriends={onOpenFriends}
        />
      )}
    </TabStack>
  );
}
