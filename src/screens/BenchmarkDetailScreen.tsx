import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { BenchmarkSummary, ResultRow } from '../features/journey/BenchmarkHistory';
import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { LogResultSheet } from '../features/journey/LogResultSheet';
import { useActions, useAppState } from '../state/DataContext';
import {
  BENCHMARK_METRIC_LABEL,
  benchmarkById,
  benchmarkSeries,
  formatBenchmarkValue,
  lowerIsBetter,
  personalBest,
  resultsFor,
  wasPersonalBest,
} from '../state/journey/benchmarks';
import type { BenchmarkResult, DayKey } from '../state/journey/types';
import { palette } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, RoundIconButton } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { useToast } from '../ui/Toast';

/**
 * One benchmark: its history, its trend, and the way to add to it.
 *
 * The personal-best badge marks the result that *was* a record when it was
 * set, not simply the current best — so back-filling an old session never
 * strips the badge from the day that actually broke the record.
 */
export default function BenchmarkDetailScreen({
  definitionId,
  bottomInset,
  onBack,
}: {
  definitionId: string;
  bottomInset: number;
  onBack: () => void;
}) {
  const state = useAppState();
  const { journey } = useActions();
  const { notify } = useToast();

  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState<BenchmarkResult | null>(null);

  const journeyState = state?.journey;

  const view = useMemo(() => {
    if (!journeyState) return null;
    const definition = benchmarkById(journeyState, definitionId);
    if (!definition) return null;

    const results = resultsFor(journeyState, definitionId);
    return {
      definition,
      results,
      best: personalBest(journeyState, definition),
      series: benchmarkSeries(journeyState, definitionId),
      units: journeyState.units,
    };
  }, [journeyState, definitionId]);

  const handleSave = useCallback(
    (value: number, date: DayKey, notes: string) => {
      if (!view) return;

      if (editing) {
        journey.updateResult(editing.id, { value, date, notes });
        notify('Result updated.', 'info');
      } else {
        journey.logResult(view.definition.id, date, value, notes);
        // Compared against the results as they were *before* this one, so the
        // congratulation is about beating the old record, not tying it.
        const beaten =
          view.best === null || lowerIsBetter(view.definition.metric)
            ? value < (view.best?.value ?? Infinity)
            : value > (view.best?.value ?? -Infinity);
        notify(beaten ? 'New personal best.' : 'Result logged.', beaten ? 'success' : 'info');
      }

      setLogging(false);
      setEditing(null);
    },
    [view, editing, journey, notify],
  );

  const handleDeleteResult = useCallback(
    (id: string) => {
      journey.deleteResult(id);
      setEditing(null);
      setLogging(false);
      notify('Result removed.', 'info');
    },
    [journey, notify],
  );

  const handleDeleteBenchmark = useCallback(() => {
    if (!view) return;
    journey.deleteBenchmark(view.definition.id);
    notify(`${view.definition.name} removed.`, 'info');
    onBack();
  }, [view, journey, notify, onBack]);

  const openNew = useCallback(() => {
    setEditing(null);
    setLogging(true);
  }, []);

  const openEdit = useCallback((result: BenchmarkResult) => {
    setEditing(result);
    setLogging(true);
  }, []);

  if (!view) {
    return (
      <View style={styles.flex}>
        <JourneyHeaderBar
          title="Benchmark"
          onBack={onBack}
          backLabel="Back to benchmarks"
        />
        <EmptyState
          icon="help-circle-outline"
          title="This benchmark is gone"
          copy="It was deleted. Go back to pick another one."
        />
      </View>
    );
  }

  const { definition, results, best, series, units } = view;
  const format = (value: number) => formatBenchmarkValue(value, definition.metric, units);

  return (
    <View style={styles.flex}>
      <JourneyHeaderBar
        title={definition.name}
        meta={`${BENCHMARK_METRIC_LABEL[definition.metric]} • ${
          lowerIsBetter(definition.metric) ? 'lower is better' : 'higher is better'
        }`}
        onBack={onBack}
        backLabel="Back to benchmarks"
        action={
          definition.isCustom ? (
            <RoundIconButton
              icon="trash-outline"
              size={44}
              onPress={handleDeleteBenchmark}
              accessibilityLabel={`Delete the ${definition.name} benchmark`}
            />
          ) : undefined
        }
      />

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ResultRow
            result={item}
            label={format(item.value)}
            isPb={wasPersonalBest(results, definition.metric, index)}
            onPress={openEdit}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={9}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={styles.header}>
            {results.length > 0 ? (
              <Appear>
                <BenchmarkSummary
                  metric={definition.metric}
                  bestLabel={best ? format(best.value) : '—'}
                  latestLabel={format(results[0].value)}
                  count={results.length}
                  series={series.map((p) => p.value)}
                  format={format}
                />
              </Appear>
            ) : null}

            <Appear delay={60}>
              <Button label="Log a result" icon="add" onPress={openNew} />
            </Appear>

            {results.length > 0 ? (
              <Text style={styles.historyLabel}>HISTORY</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="stopwatch-outline"
            title="Not tested yet"
            copy="Log your first result and this becomes something to beat."
          />
        }
      />

      <LogResultSheet
        visible={logging}
        definition={definition}
        units={units}
        existing={editing}
        onClose={() => {
          setLogging(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={editing ? handleDeleteResult : undefined}
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
  header: {
    gap: 14,
    paddingBottom: 6,
  },
  historyLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
    paddingTop: 4,
  },
});
