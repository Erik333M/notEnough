import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme/theme';
import { RoundIconButton } from './Controls';

/**
 * The bar at the top of a drill-down inside a feature that owns its own stack.
 *
 * The shell's header names the *route*, which stays the same however deep you
 * go; this says where you actually are and, crucially, offers the way back.
 * Shared so the back affordance is in the same place, the same size and
 * carries the same kind of screen-reader label everywhere it appears.
 */
export type StackHeaderProps = {
  title: string;
  meta?: string;
  onBack: () => void;
  /** Announced to screen readers, e.g. "Back to your teams". */
  backLabel: string;
  /** Optional trailing action, and an optional slot under the title. */
  action?: React.ReactNode;
  below?: React.ReactNode;
};

export const StackHeaderBar = memo(function StackHeaderBar({
  title,
  meta,
  onBack,
  backLabel,
  action,
  below,
}: StackHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <RoundIconButton icon="chevron-back" size={44} onPress={onBack} accessibilityLabel={backLabel} />
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {below}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: palette.text },
  meta: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
});
