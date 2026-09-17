import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { accentColor, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';

/**
 * One of the two shortcuts under the hero on Today.
 *
 * Lifted out of the screen when Today grew past a scannable length. It is a
 * card, not a button, because the things it leads to are places rather than
 * actions — and a place deserves a title and a line about it.
 */
export const QuickAction = memo(function QuickAction({
  icon,
  title,
  copy,
  accent,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  copy: string;
  accent: 'cyan' | 'violet';
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} haptic="medium" scaleTo={0.96} style={{ flex: 1 }}>
      <GlassCard style={styles.card}>
        <Ionicons name={icon} size={22} color={accentColor[accent]} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>{copy}</Text>
      </GlassCard>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: { gap: 8, padding: 14 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  copy: { fontSize: 11.5, fontWeight: '600', color: palette.textMuted },
});
