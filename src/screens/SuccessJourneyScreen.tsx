import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { useIntake } from '../features/journey/useIntake';
import { useJourneyStack } from '../features/journey/useJourneyStack';
import { BootSplash } from '../ui/Feedback';
import BenchmarkDetailScreen from './BenchmarkDetailScreen';
import BenchmarksListScreen from './BenchmarksListScreen';
import DailyEntryScreen from './DailyEntryScreen';
import HabitsScreen from './HabitsScreen';
import JourneyProgressScreen from './JourneyProgressScreen';
import MeasurementsScreen from './MeasurementsScreen';
import MovementsLibraryScreen from './MovementsLibraryScreen';
import OnboardingFlow from './OnboardingFlow';
import SuccessJourneyHomeScreen from './SuccessJourneyHomeScreen';
import WodBuilderScreen from './WodBuilderScreen';

/**
 * The single route the app shell knows about.
 *
 * Everything inside the feature is addressed by the local stack rather than by
 * a shell route, so drill-downs can carry params (which date? which benchmark?)
 * that the shell's flat `RouteKey` union cannot express.
 *
 * Onboarding sits in front of the stack rather than inside it: it is shown
 * once, it has no back path, and skipping it must land on today rather than
 * unwinding to a previous step.
 */
export default function SuccessJourneyScreen({ bottomInset }: { bottomInset: number }) {
  const nav = useJourneyStack();
  const { intake, status, save, skip } = useIntake();

  // Android's hardware back pops the feature's stack before it leaves the app,
  // so a drill-down is never a one-way trip.
  useEffect(() => {
    if (!nav.canGoBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      nav.back();
      return true;
    });
    return () => sub.remove();
  }, [nav]);

  // A brief splash rather than a flash of today followed by onboarding
  // sliding over it — the intake read is a Keychain hit, not a network call.
  if (status === 'loading') return <BootSplash label="Opening your journey" />;

  if (status === 'needed') {
    return (
      <OnboardingFlow
        intake={intake}
        bottomInset={bottomInset}
        onSave={(next) => void save(next)}
        onSkip={() => void skip()}
      />
    );
  }

  if (nav.view.key === 'entry') {
    return (
      <DailyEntryScreen
        date={nav.view.date}
        bottomInset={bottomInset}
        onBack={nav.back}
        onOpenWod={nav.openWod}
      />
    );
  }

  if (nav.view.key === 'wod') {
    return (
      <WodBuilderScreen
        date={nav.view.date}
        bottomInset={bottomInset}
        onBack={nav.back}
        onBrowseMovements={nav.openMovements}
      />
    );
  }

  if (nav.view.key === 'movements') {
    return <MovementsLibraryScreen bottomInset={bottomInset} onBack={nav.back} />;
  }

  if (nav.view.key === 'habits') {
    return <HabitsScreen bottomInset={bottomInset} onBack={nav.back} />;
  }

  if (nav.view.key === 'measurements') {
    return <MeasurementsScreen bottomInset={bottomInset} onBack={nav.back} />;
  }

  if (nav.view.key === 'progress') {
    return <JourneyProgressScreen bottomInset={bottomInset} onBack={nav.back} />;
  }

  if (nav.view.key === 'benchmarks') {
    return (
      <BenchmarksListScreen
        bottomInset={bottomInset}
        onBack={nav.back}
        onOpen={nav.openBenchmark}
      />
    );
  }

  if (nav.view.key === 'benchmark') {
    return (
      <BenchmarkDetailScreen
        definitionId={nav.view.id}
        bottomInset={bottomInset}
        onBack={nav.back}
      />
    );
  }

  return (
    <SuccessJourneyHomeScreen
      bottomInset={bottomInset}
      onOpenEntry={nav.openEntry}
      onOpenWod={nav.openWod}
      onOpenBenchmarks={nav.openBenchmarks}
      onOpenMeasurements={nav.openMeasurements}
      onOpenHabits={nav.openHabits}
      onOpenProgress={nav.openProgress}
    />
  );
}
