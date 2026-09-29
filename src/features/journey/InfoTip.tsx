import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { PressableScale } from '../../ui/Touchable';
import { EXPLAINERS, type ExplainerKey } from './journeyCopy';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * The info affordance that sits beside a piece of jargon.
 *
 * A small circled "i" rather than a tooltip on the term itself: the label has
 * to stay tappable-free for screen readers, and a 16pt glyph is not a target.
 * The touch area is padded out to 44pt while the glyph stays small.
 */
export const InfoTip = memo(function InfoTip({ topic }: { topic: ExplainerKey }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  const explainer = EXPLAINERS[topic];

  return (
    <>
      <PressableScale
        onPress={show}
        haptic="selection"
        scaleTo={0.85}
        hitSlop={14}
        accessibilityLabel={`What does ${explainer.term} mean?`}
        style={styles.trigger}
      >
        <Ionicons name="information-circle-outline" size={17} color={theme.textFaint} />
      </PressableScale>

      <Modal visible={open} transparent animationType="fade" onRequestClose={hide} statusBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hide} accessibilityLabel="Close" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.grabber} />
            <Text style={styles.term}>{explainer.term}</Text>
            <Text style={styles.short}>{explainer.short}</Text>
            {explainer.detail ? <Text style={styles.detail}>{explainer.detail}</Text> : null}
            <Button label="Got it" onPress={hide} />
          </View>
        </View>
      </Modal>
    </>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  trigger: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  sheet: {
    backgroundColor: theme.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.borderStrong,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.borderStrong,
    marginBottom: 6,
  },
  term: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  short: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.text,
  },
  detail: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: theme.textMuted,
  },
});
