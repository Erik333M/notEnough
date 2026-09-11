import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { BenchmarkRow } from '../features/journey/BenchmarkRow';
import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { NewBenchmarkSheet } from '../features/journey/NewBenchmarkSheet';
import { useActions, useAppState } from '../state/DataContext';
import {
  BENCHMARK_GROUP_LABEL,
  allBenchmarks,
  personalBest,
  resultCount,
} from '../state/journey/benchmarks';
import type {
  BenchmarkDefinition,
  BenchmarkGroup,
  BenchmarkMetric,
} from '../state/journey/types';
import { palette, radius } from '../theme/theme';
import { RoundIconButton } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { useToast } from '../ui/Toast';

/**
 * Every benchmark, grouped the way the workbook groups them.
 *
 * A `SectionList` rather than a plain map: the seeded catalogue is already
 * thirty-odd tests and users add their own, so the list is unbounded and the
 * group headings need to stick as it scrolls.
 */
type Section = {
  group: BenchmarkGroup;
  title: string;
  data: BenchmarkDefinition[];
};

export default function BenchmarksListScreen({
  bottomInset,
  onBack,
  onOpen,
}: {
  bottomInset: number;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const state = useAppState();
  const { journey } = useActions();
  const { notify } = useToast();

  const [creating, setCreating] = useState(false);

  const journeyState = state?.journey;

  /**
   * Rows carry their own best and count so the list renders in one pass over
   * the results rather than one pass per row.
   */
  const { sections, tested } = useMemo(() => {
    if (!journeyState) return { sections: [] as Section[], tested: 0 };

    const definitions = allBenchmarks(journeyState);
    const groups = Object.keys(BENCHMARK_GROUP_LABEL) as BenchmarkGroup[];

    let testedCount = 0;
    for (const definition of definitions) {
      if (resultCount(journeyState, definition.id) > 0) testedCount += 1;
    }

    const built = groups
      .map((group) => ({
        group,
        title: BENCHMARK_GROUP_LABEL[group],
        data: definitions.filter((d) => d.group === group),
      }))
      .filter((section) => section.data.length > 0);

    return { sections: built, tested: testedCount };
  }, [journeyState]);

  const handleCreate = useCallback(
    (name: string, group: BenchmarkGroup, metric: BenchmarkMetric) => {
      const created = journey.addBenchmark(name, group, metric);
      setCreating(false);
      notify(`${name} added.`, 'success');
      onOpen(created.id);
    },
    [journey, notify, onOpen],
  );

  return (
    <View style={styles.flex}>
      <JourneyHeaderBar
        title="Benchmarks"
        meta={tested > 0 ? `${tested} tested` : 'Test, re-test, compare'}
        onBack={onBack}
        backLabel="Back to the journey home"
        topic="benchmark"
        action={
          <RoundIconButton
            icon="add"
            size={44}
            accent="lime"
            onPress={() => setCreating(true)}
            accessibilityLabel="Add a benchmark"
          />
        }
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          journeyState ? (
            <BenchmarkRow
              definition={item}
              best={personalBest(journeyState, item)}
              count={resultCount(journeyState, item.id)}
              units={journeyState.units}
              onOpen={onOpen}
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={9}
        removeClippedSubviews
        ListHeaderComponent={
          <Text style={styles.lede}>
            Pick a test, record what you managed, then come back to it in a few weeks. The
            point is the comparison, not the number.
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            icon="stopwatch-outline"
            title="No benchmarks yet"
            copy="Add a test you want to repeat and compare over time."
          />
        }
      />

      <NewBenchmarkSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 18,
  },
  lede: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.textMuted,
    paddingBottom: 14,
  },
  sectionHeader: {
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: palette.bg0,
    borderRadius: radius.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
});
