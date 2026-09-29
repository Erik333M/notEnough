import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { MOVEMENT_CATEGORY_LABEL } from '../../state/journey/movements';
import type { MovementCategory } from '../../state/journey/types';
import { radius } from '../../theme/theme';
import { Chip } from '../../ui/Controls';
import { PressableScale } from '../../ui/Touchable';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * Search field plus category filters.
 *
 * Shared by the picker sheet and the library screen, which are the same
 * search over the same catalogue in two frames — keeping one copy means the
 * filter chips can never drift out of step between them.
 *
 * Tapping the active category clears it, so the filter is always escapable
 * without hunting for an "all" chip.
 */
export const CATEGORY_KEYS = Object.keys(MOVEMENT_CATEGORY_LABEL) as MovementCategory[];

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  category: MovementCategory | null;
  onCategoryChange: (next: MovementCategory | null) => void;
};

export const MovementSearchBar = memo(function MovementSearchBar({
  query,
  onQueryChange,
  category,
  onCategoryChange,
}: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const handleCategory = useCallback(
    (next: MovementCategory) => onCategoryChange(category === next ? null : next),
    [category, onCategoryChange],
  );

  const clear = useCallback(() => onQueryChange(''), [onQueryChange]);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={17} color={theme.textFaint} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search movements"
          placeholderTextColor={theme.textFaint}
          style={styles.search}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          selectionColor={theme.accent.spirit}
          accessibilityLabel="Search movements"
        />
        {query ? (
          <PressableScale
            onPress={clear}
            haptic="selection"
            scaleTo={0.85}
            hitSlop={12}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={17} color={theme.textFaint} />
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.filters}>
        {CATEGORY_KEYS.map((key) => (
          <Chip
            key={key}
            label={MOVEMENT_CATEGORY_LABEL[key]}
            active={category === key}
            accent="mind"
            onPress={() => handleCategory(key)}
          />
        ))}
      </View>
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrap: {
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSunken,
  },
  search: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    padding: 0,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
