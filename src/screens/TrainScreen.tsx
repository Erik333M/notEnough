import { useStack } from '../lib/useStack';
import { TabStack } from '../navigation/TabStack';
import PlanScreen from './PlanScreen';
import TimerScreen from './TimerScreen';

/**
 * The Train tab: the timer, with the training plan behind it.
 *
 * Grouped because they answer the same question at two distances — what am I
 * doing right now, and where is this going. Neither earned a tab of its own
 * once the bar had to hold five.
 */
type View = { key: 'timer' } | { key: 'plan' };

export default function TrainScreen({ bottomInset }: { bottomInset: number }) {
  const stack = useStack<View>({ key: 'timer' });

  return (
    <TabStack
      stack={stack}
      title={stack.current.key === 'plan' ? 'Training plan' : null}
      meta="Projected path to your goal"
      backLabel="Back to the timer"
    >
      {stack.current.key === 'plan' ? (
        <PlanScreen bottomInset={bottomInset} />
      ) : (
        <TimerScreen bottomInset={bottomInset} onOpenPlan={() => stack.push({ key: 'plan' })} />
      )}
    </TabStack>
  );
}
