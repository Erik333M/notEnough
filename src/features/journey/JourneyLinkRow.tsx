import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../../state/types';
import { accentColor, accentSoft, palette, radius, type AccentName } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * A way into one of the feature's longer-horizon modules.
 *
 * These live below the daily cards on the home screen, under their own
 * heading, because benchmarks and measurements are not things you fill in
 * every day — putting them beside today's decision would make the page look
 * like a checklist you are behind on.
 *
 * `meta` carries the module's current state ("3 tested", "no readings yet") so
 * the row answers "is there anything in here?" without being opened.
 */
type Props = {
  icon: IconName;
  title: string;
  meta: string;
  accent?: AccentName;
  onPress: () => void;
};

export const JourneyLinkRow = memo(function JourneyLinkRow({
  icon,
  title,
  meta,
  accent = 'violet',
  onPress,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scaleTo={0.98}
      accessibilityLabel={`${title}. ${meta}`}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: accentSoft[accent] }]}>
        <Ionicons name={icon} size={18} color={accentColor[accent]} />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  meta: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 2,
  },
});
