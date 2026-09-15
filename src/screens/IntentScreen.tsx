import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { INTENT_CHOICES, type Intent, type IntentChoice } from '../features/teams/intentChoices';
import { gradients, palette, radius, shadow } from '../theme/theme';
import { Button } from '../ui/Button';
import { PressableScale } from '../ui/Touchable';

export type { Intent };

/**
 * The first screen of the app, and one question long.
 *
 * It chooses where you land and nothing else. It is not a role, it is not sent
 * anywhere, and it locks nothing: whatever you tap here you can create a team
 * or join one later from the same place, as often as you like. That is why it
 * is a device preference rather than anything stored against the account.
 *
 * Being first, it does the most work per second of anything in the app — so it
 * is built as a proper opening rather than a form: one heading, three answers
 * that each say what happens next, and a way past it. Everything animates in
 * on a short stagger so the eye is led down the three choices in order instead
 * of meeting them all at once.
 */
export default function IntentScreen({
  name,
  onChoose,
  onSkip,
}: {
  name: string;
  onChoose: (intent: Intent) => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();

  // One slow breath behind the mark. Driven on the UI thread by a shared
  // value, so it costs nothing in React and never competes with the entrance
  // animations below it.
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.3,
    transform: [{ scale: 1 + glow.value * 0.12 }],
  }));

  const firstName = name.trim().split(' ')[0] || 'there';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(500)} style={styles.hero}>
          <View style={styles.markWrap}>
            <Animated.View style={[styles.glow, glowStyle]} />
            <LinearGradient
              colors={gradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mark}
            >
              <Ionicons name="flash" size={22} color={palette.onAccent} />
            </LinearGradient>
          </View>
          <Text style={styles.kicker}>WELCOME, {firstName.toUpperCase()}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(520)}>
          <Text style={styles.title}>How will you use this?</Text>
          <Text style={styles.copy}>
            Just so we open on the right screen. Nothing here is saved to your profile, and you
            can change your mind whenever you like.
          </Text>
        </Animated.View>

        <View style={styles.list}>
          {INTENT_CHOICES.map((choice, index) => (
            <Animated.View
              key={choice.key}
              entering={FadeInDown.delay(220 + index * 110)
                .duration(520)
                .springify()
                .damping(18)}
            >
              <ChoiceCard choice={choice} onPress={() => onChoose(choice.key)} />
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeIn.delay(680).duration(420)}>
          <Button label="Skip for now" variant="ghost" onPress={onSkip} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const ChoiceCard = memo(function ChoiceCard({
  choice,
  onPress,
}: {
  choice: IntentChoice;
  onPress: () => void;
}) {
  return (
    <PressableScale haptic="light" scaleTo={0.97} onPress={onPress} accessibilityLabel={choice.title}>
      <View style={[styles.card, shadow.card]}>
        {/* Accent wash, strongest at the icon and gone by the chevron. */}
        <LinearGradient
          colors={[`${choice.tint}26`, `${choice.tint}00`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none', borderRadius: radius.lg }]}
        />
        <LinearGradient
          colors={choice.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardIcon}
        >
          <Ionicons name={choice.icon} size={19} color={palette.onAccent} />
        </LinearGradient>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{choice.title}</Text>
          <Text style={styles.cardCopy}>{choice.copy}</Text>
          <View style={styles.nextRow}>
            <Ionicons name="arrow-forward" size={11} color={choice.tint} />
            <Text style={[styles.nextText, { color: choice.tint }]}>{choice.next}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },
  hero: { alignItems: 'center', gap: 14 },
  markWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.violetSoft,
  },
  mark: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: palette.textFaint,
  },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  copy: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: palette.textMuted,
    textAlign: 'center',
  },
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: palette.text },
  cardCopy: { fontSize: 12.5, lineHeight: 17.5, fontWeight: '600', color: palette.textMuted },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  nextText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
});
