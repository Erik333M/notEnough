import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchMovements } from '../../state/journey/movements';
import type { Movement, MovementCategory } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { BrowseAllRow, MovementResultRow, NoMatchActions } from './MovementPickerRows';
import { MovementSearchBar } from './MovementSearch';

/**
 * Search-and-pick sheet for a WOD line.
 *
 * Typing filters the catalogue; if nothing matches, the query itself becomes a
 * one-tap "add this movement" row. That is the important behaviour — a user
 * whose movement is not in the list must never hit a dead end mid-workout, and
 * they should not have to leave the builder to fix it.
 *
 * Picking is also allowed to be *just text*: `onPickFreeText` records what they
 * typed without adding anything to the catalogue, for a one-off they will never
 * log again.
 */
type Props = {
  visible: boolean;
  movements: Movement[];
  onClose: () => void;
  onPick: (movement: Movement) => void;
  onCreate: (name: string, category: MovementCategory) => void;
  onPickFreeText: (text: string) => void;
  onBrowseAll: () => void;
};

export function MovementPicker({
  visible,
  movements,
  onClose,
  onPick,
  onCreate,
  onPickFreeText,
  onBrowseAll,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MovementCategory | null>(null);

  // Reset on open so the last search does not greet the next line.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setCategory(null);
  }, [visible]);

  const results = useMemo(
    () => searchMovements(movements, query, category),
    [movements, query, category],
  );

  const trimmed = query.trim();
  // Only offer to create when the text is not already a movement by that name.
  const canCreate =
    trimmed.length >= 2 && !results.some((m) => m.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.grabber} />

            <MovementSearchBar
              query={query}
              onQueryChange={setQuery}
              category={category}
              onCategoryChange={setCategory}
            />

            {canCreate ? (
              <NoMatchActions
                query={trimmed}
                onCreate={() => onCreate(trimmed, category ?? 'strength')}
                onUseOnce={() => onPickFreeText(trimmed)}
              />
            ) : null}

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MovementResultRow movement={item} onPick={onPick} />}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              initialNumToRender={12}
              windowSize={7}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {trimmed
                    ? 'No match — add it above, or use it just this once.'
                    : 'No movements in this category yet.'}
                </Text>
              }
              ListFooterComponent={<BrowseAllRow onPress={onBrowseAll} />}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,3,10,0.72)',
  },
  sheetWrap: {
    height: '86%',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 12,
  },
  empty: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textFaint,
    paddingVertical: 18,
    textAlign: 'center',
  },
});
