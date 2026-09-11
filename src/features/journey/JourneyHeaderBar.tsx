import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../../theme/theme';
import { RoundIconButton } from '../../ui/Controls';
import { InfoTip } from './InfoTip';
import type { ExplainerKey } from './journeyCopy';

/**
 * The bar at the top of every drill-down inside the Journey tab.
 *
 * The app shell's header shows the *route*, which is always "Success Journey";
 * this shows where you actually are within it and, crucially, the way back.
 * One component so the back affordance is in the same place, the same size and
 * carries the same kind of screen-reader label on every screen.
 */
type Props = {
  title: string;
  meta?: string;
  onBack: () => void;
  /** Announced to screen readers, e.g. "Back to the day". */
  backLabel: string;
  /** Puts an info affordance next to the title. */
  topic?: ExplainerKey;
  /** Optional action on the trailing edge. */
  action?: React.ReactNode;
};

export const JourneyHeaderBar = memo(function JourneyHeaderBar({
  title,
  meta,
  onBack,
  backLabel,
  topic,
  action,
}: Props) {
  return (
    <View style={styles.bar}>
      <RoundIconButton
        icon="chevron-back"
        size={44}
        onPress={onBack}
        accessibilityLabel={backLabel}
      />

      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {topic ? <InfoTip topic={topic} /> : null}
        </View>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>

      {action}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  text: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 1,
  },
});
