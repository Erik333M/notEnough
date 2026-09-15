import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../state/types';
import { accentColor, palette, radius, type AccentName } from '../theme/theme';
import { Appear } from '../ui/Controls';
import { Button } from '../ui/Button';
import { GlassCard } from '../ui/Glass';
import { PressableScale } from '../ui/Touchable';

/**
 * One question, asked once, on the first open.
 *
 * It chooses where you land and nothing else. It is not a role, it is not sent
 * anywhere, and it locks nothing: whatever you tap here, you can create a team
 * or join one later from the same place, and change your mind as often as you
 * like. That is why it is a device preference rather than anything stored
 * against the account.
 *
 * It is skippable, in keeping with the rest of the app's opening — nobody is
 * held behind a question to reach the thing they downloaded.
 */
export type Intent = 'solo' | 'athlete' | 'coach';

const CHOICES: {
  key: Intent;
  icon: IconName;
  accent: AccentName;
  title: string;
  copy: string;
}[] = [
  {
    key: 'solo',
    icon: 'person-outline',
    accent: 'lime',
    title: 'Train on my own',
    copy: 'Straight to today. Everything you log stays private to you.',
  },
  {
    key: 'athlete',
    icon: 'barbell-outline',
    accent: 'cyan',
    title: 'Train with a coach',
    copy: 'We will ask for the code your coach gave you. They see only the work they set.',
  },
  {
    key: 'coach',
    icon: 'clipboard-outline',
    accent: 'violet',
    title: 'Coach others',
    copy: 'Start a team and invite athletes with a code. You can still train yourself.',
  },
];

export default function IntentScreen({
  onChoose,
  onSkip,
}: {
  onChoose: (intent: Intent) => void;
  onSkip: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Appear>
        <Text style={styles.title}>How will you use this?</Text>
        <Text style={styles.copy}>
          Just so we open on the right screen. You can change your mind at any time, and nothing
          here is saved to your profile.
        </Text>
      </Appear>

      <View style={styles.list}>
        {CHOICES.map((choice, index) => (
          <Appear key={choice.key} delay={60 * (index + 1)}>
            <Choice choice={choice} onPress={() => onChoose(choice.key)} />
          </Appear>
        ))}
      </View>

      <Appear delay={260}>
        <Button label="Skip for now" variant="ghost" onPress={onSkip} />
      </Appear>
    </ScrollView>
  );
}

const Choice = memo(function Choice({
  choice,
  onPress,
}: {
  choice: (typeof CHOICES)[number];
  onPress: () => void;
}) {
  return (
    <PressableScale haptic="light" onPress={onPress} accessibilityLabel={choice.title}>
      <GlassCard style={styles.card}>
        <View style={[styles.icon, { backgroundColor: `${accentColor[choice.accent]}22` }]}>
          <Ionicons name={choice.icon} size={20} color={accentColor[choice.accent]} />
        </View>
        <View style={styles.body}>
          <Text style={styles.cardTitle}>{choice.title}</Text>
          <Text style={styles.cardCopy}>{choice.copy}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
      </GlassCard>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 40, gap: 18 },
  title: { fontSize: 24, fontWeight: '800', color: palette.text },
  copy: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: palette.textMuted,
  },
  list: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15.5, fontWeight: '800', color: palette.text },
  cardCopy: { fontSize: 12.5, lineHeight: 17, fontWeight: '600', color: palette.textMuted },
});
