import { useStack } from '../lib/useStack';
import { TabStack } from '../navigation/TabStack';
import MovementsLibraryScreen from './MovementsLibraryScreen';
import PlanScreen from './PlanScreen';
import TimerScreen from './TimerScreen';

/**
 * The Train tab: how you train, at three distances.
 *
 * Right now (the timer), what the movements are and what they work (the
 * library and its body map), and where this is all going (the plan).
 *
 * The library used to live four levels down the Journey tab — behind today,
 * behind the workout card, behind a link in a movement picker — which meant
 * the body map, one of the most useful things here, was effectively hidden
 * from anybody not already building a workout. A tab called Train is where
 * somebody looks for it.
 */
type View = { key: 'timer' } | { key: 'plan' } | { key: 'movements' };

const TITLES: Record<View['key'], string | null> = {
  timer: null,
  plan: 'Training plan',
  movements: 'Movements',
};

const METAS: Record<View['key'], string | undefined> = {
  timer: undefined,
  plan: 'Projected path to your goal',
  movements: 'What every exercise works',
};

export default function TrainScreen({ bottomInset }: { bottomInset: number }) {
  const stack = useStack<View>({ key: 'timer' });
  const view = stack.current;

  return (
    <TabStack
      stack={stack}
      title={TITLES[view.key]}
      meta={METAS[view.key]}
      backLabel="Back to the timer"
    >
      {view.key === 'plan' ? (
        <PlanScreen bottomInset={bottomInset} />
      ) : view.key === 'movements' ? (
        <MovementsLibraryScreen bottomInset={bottomInset} onBack={stack.back} />
      ) : (
        <TimerScreen
          bottomInset={bottomInset}
          onOpenPlan={() => stack.push({ key: 'plan' })}
          onOpenMovements={() => stack.push({ key: 'movements' })}
        />
      )}
    </TabStack>
  );
}
