import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BaselineCard } from '../features/journey/BaselineCard';
import { BaselineSheet } from '../features/journey/BaselineSheet';
import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { LogMeasurementSheet } from '../features/journey/LogMeasurementSheet';
import { MeasurementHistoryRow } from '../features/journey/MeasurementHistoryRow';
import { MetricCard } from '../features/journey/MetricCard';
import { useActions, useAppState } from '../state/DataContext';
import {
  MEASUREMENT_METRICS,
  metricSeries,
  sortedMeasurements,
} from '../state/journey/measurements';
import type {
  DayKey,
  MeasurementBaseline,
  MeasurementEntry,
  UnitSystem,
} from '../state/journey/types';
import { palette } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, Segmented } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { useToast } from '../ui/Toast';

const UNIT_OPTIONS = [
  { value: 'metric' as const, label: 'kg / cm' },
  { value: 'imperial' as const, label: 'lb / in' },
];

/**
 * Body measurements.
 *
 * Only metrics that actually hold a reading get a card. Someone who logs
 * nothing but weight sees one chart, not eight empty ones — which is the whole
 * requirement, and the reason the screen builds its list from the data rather
 * than from the catalogue.
 */
export default function MeasurementsScreen({
  bottomInset,
  onBack,
}: {
  bottomInset: number;
  onBack: () => void;
}) {
  const state = useAppState();
  const { journey } = useActions();
  const { notify } = useToast();

  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState<MeasurementEntry | null>(null);
  const [editingBaseline, setEditingBaseline] = useState(false);

  const journeyState = state?.journey;

  const view = useMemo(() => {
    if (!journeyState) return null;
    const units = journeyState.units;

    return {
      units,
      baseline: journeyState.baseline,
      history: sortedMeasurements(journeyState),
      // Built from the data: a metric with no readings has no card.
      tracked: MEASUREMENT_METRICS.map((metric) => ({
        metric,
        points: metricSeries(journeyState, metric.key, units),
      })).filter((entry) => entry.points.length > 0),
    };
  }, [journeyState]);

  const handleUnits = useCallback(
    (units: UnitSystem) => {
      journey.setUnits(units);
    },
    [journey],
  );

  const handleSaveBaseline = useCallback(
    (patch: MeasurementBaseline) => {
      journey.setBaseline(patch);
      setEditingBaseline(false);
      notify('Baseline saved.', 'success');
    },
    [journey, notify],
  );

  const handleSave = useCallback(
    (date: DayKey, values: Partial<MeasurementEntry>) => {
      if (editing) {
        journey.updateMeasurement(editing.id, { ...values, date });
        notify('Reading updated.', 'info');
      } else {
        journey.logMeasurement(date, values);
        notify('Reading saved.', 'success');
      }
      setLogging(false);
      setEditing(null);
    },
    [editing, journey, notify],
  );

  const handleDelete = useCallback(
    (id: string) => {
      journey.deleteMeasurement(id);
      setLogging(false);
      setEditing(null);
      notify('Reading removed.', 'info');
    },
    [journey, notify],
  );

  const openNew = useCallback(() => {
    setEditing(null);
    setLogging(true);
  }, []);

  const openEdit = useCallback((entry: MeasurementEntry) => {
    setEditing(entry);
    setLogging(true);
  }, []);

  if (!view) {
    return (
      <View style={styles.flex}>
        <JourneyHeaderBar title="Measurements" onBack={onBack} backLabel="Back" />
      </View>
    );
  }

  const { units, baseline, history, tracked } = view;

  return (
    <View style={styles.flex}>
      <JourneyHeaderBar
        title="Measurements"
        meta={
          history.length > 0
            ? `${history.length} ${history.length === 1 ? 'reading' : 'readings'}`
            : 'Only what you want to track'
        }
        onBack={onBack}
        backLabel="Back to the journey home"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        <Appear>
          <View style={styles.units}>
            <Segmented options={UNIT_OPTIONS} value={units} onChange={handleUnits} />
          </View>
        </Appear>

        <Appear delay={40}>
          <BaselineCard
            baseline={baseline}
            units={units}
            onEdit={() => setEditingBaseline(true)}
          />
        </Appear>

        <Appear delay={80}>
          <Button label="Log a reading" icon="add" onPress={openNew} />
        </Appear>

        {tracked.length === 0 ? (
          <Appear delay={120}>
            <EmptyState
              icon="pulse-outline"
              title="Nothing tracked yet"
              copy="Log a weight — or anything else you happen to know — and it starts charting itself."
            />
          </Appear>
        ) : (
          tracked.map((entry, index) => (
            <Appear key={entry.metric.key} delay={120 + index * 40}>
              <MetricCard metric={entry.metric} points={entry.points} units={units} />
            </Appear>
          ))
        )}

        {history.length > 0 ? (
          <>
            <Appear delay={200}>
              <Text style={styles.historyLabel}>HISTORY</Text>
            </Appear>

            {history.map((entry) => (
              <MeasurementHistoryRow key={entry.id} entry={entry} onPress={openEdit} />
            ))}
          </>
        ) : null}
      </ScrollView>

      <LogMeasurementSheet
        visible={logging}
        units={units}
        existing={editing}
        onClose={() => {
          setLogging(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
      />

      <BaselineSheet
        visible={editingBaseline}
        baseline={baseline}
        units={units}
        onClose={() => setEditingBaseline(false)}
        onSave={handleSaveBaseline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  units: {
    alignSelf: 'flex-start',
    minWidth: 200,
  },
  historyLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
    paddingTop: 4,
  },
});
