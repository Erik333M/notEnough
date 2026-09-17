import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { MovementSearchBar } from '../features/journey/MovementSearch';
import { NewMovementSheet } from '../features/journey/NewMovementSheet';
import { useActions, useAppState } from '../state/DataContext';
import {
  MOVEMENT_CATEGORY_LABEL,
  allMovements,
  searchMovements,
} from '../state/journey/movements';
import type { Movement, MovementCategory } from '../state/journey/types';
import { muscleSummary } from '../state/journey/muscles';
import { MuscleSheet } from '../features/muscles/MuscleSheet';
import { accentColor, palette } from '../theme/theme';
import { Appear, RoundIconButton } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { PressableScale } from '../ui/Touchable';
import { useToast } from '../ui/Toast';

/**
 * The movements catalogue.
 *
 * Read-mostly: the seeded list cannot be edited, only added to. Custom
 * movements are marked and can be deleted, which is safe because a WOD line
 * keeps the movement's name in its own `freeText` — deleting a movement from
 * the library never blanks a workout that used it.
 *
 * Virtualised, because this list is unbounded once a user starts adding their
 * own and it is the one screen in the feature that can grow without limit.
 */
const Row = memo(function Row({
  movement,
  onDelete,
  onShowMuscles,
}: {
  movement: Movement;
  onDelete: (movement: Movement) => void;
  onShowMuscles: (movement: Movement) => void;
}) {
  const handleDelete = useCallback(() => onDelete(movement), [movement, onDelete]);
  const tagged = movement.muscles.primary.length > 0;

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {movement.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {MOVEMENT_CATEGORY_LABEL[movement.category]}
          {tagged ? ` • ${muscleSummary(movement.muscles)}` : ''}
        </Text>
      </View>

      {/* The figure is the point of the tagging, so it is one tap from a row. */}
      {tagged ? (
        <PressableScale
          onPress={() => onShowMuscles(movement)}
          haptic="light"
          scaleTo={0.86}
          hitSlop={10}
          accessibilityLabel={`Which muscles ${movement.name} works`}
          style={styles.delete}
        >
          <Ionicons name="body-outline" size={16} color={accentColor.rose} />
        </PressableScale>
      ) : null}

      {movement.isCustom ? (
        <PressableScale
          onPress={handleDelete}
          haptic="light"
          scaleTo={0.86}
          hitSlop={10}
          accessibilityLabel={`Delete ${movement.name}`}
          style={styles.delete}
        >
          <Ionicons name="trash-outline" size={15} color={palette.textFaint} />
        </PressableScale>
      ) : null}
    </View>
  );
});

export default function MovementsLibraryScreen({
  bottomInset,
  onBack,
}: {
  bottomInset: number;
  onBack: () => void;
}) {
  const state = useAppState();
  const { journey } = useActions();
  const { notify } = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MovementCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [showing, setShowing] = useState<Movement | null>(null);

  const journeyState = state?.journey;

  const results = useMemo(() => {
    if (!journeyState) return [];
    return searchMovements(allMovements(journeyState), query, category);
  }, [journeyState, query, category]);

  const handleDelete = useCallback(
    (movement: Movement) => {
      journey.deleteMovement(movement.id);
      notify(`${movement.name} removed. Workouts that used it keep the name.`, 'info');
    },
    [journey, notify],
  );

  const handleCreate = useCallback(
    (name: string, cat: MovementCategory) => {
      journey.addMovement(name, cat);
      setCreating(false);
      notify(`${name} added.`, 'success');
    },
    [journey, notify],
  );

  const customCount = journeyState?.movements.length ?? 0;
  const bodyForm = journeyState?.bodyForm ?? 'male';

  return (
    <View style={styles.flex}>
      <JourneyHeaderBar
        title="Movements"
        meta={`${results.length} shown${customCount > 0 ? ` • ${customCount} yours` : ''}`}
        onBack={onBack}
        backLabel="Back"
        action={
          <RoundIconButton
            icon="add"
            size={44}
            accent="lime"
            onPress={() => setCreating(true)}
            accessibilityLabel="Add a movement"
          />
        }
      />

      <View style={styles.controls}>
        <MovementSearchBar
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Row movement={item} onDelete={handleDelete} onShowMuscles={setShowing} />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={
          <Appear>
            <EmptyState
              icon="barbell-outline"
              title="Nothing matches"
              copy={
                query
                  ? 'Try a shorter search, or add it as your own movement.'
                  : 'No movements in this category yet.'
              }
            />
          </Appear>
        }
      />

      <NewMovementSheet
        visible={creating}
        initialName={query}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
      />

      <MuscleSheet
        name={showing?.name ?? null}
        work={showing?.muscles ?? { primary: [], secondary: [] }}
        form={bodyForm}
        onChangeForm={journey.setBodyForm}
        onClose={() => setShowing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  list: {
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  },
  rowText: {
    flex: 1,
    paddingVertical: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  rowMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 2,
  },
  delete: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
