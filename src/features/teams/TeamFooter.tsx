import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { accentColor, palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Appear } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';

/**
 * The two things at the bottom of a team: what your coach can see, and the way
 * out.
 *
 * The visibility link is shown to athletes only — a coach knows what they can
 * see, and the person who needs that answer is the one being seen.
 *
 * Leaving states its consequence before you tap it, because "leave" reads like
 * it might delete something and it does not.
 */
export const TeamFooter = memo(function TeamFooter({
  teamName,
  isCoach,
  onOpenVisibility,
  onLeave,
}: {
  teamName: string;
  isCoach: boolean;
  onOpenVisibility: (teamName: string) => void;
  onLeave: () => void;
}) {
  return (
    <>
      {!isCoach ? (
        <Appear delay={160}>
          <PressableScale
            haptic="light"
            onPress={() => onOpenVisibility(teamName)}
            accessibilityLabel="What your coach can see"
          >
            <GlassCard style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name="eye-outline" size={16} color={accentColor.lime} />
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>What your coach can see</Text>
                <Text style={styles.copy}>The work they set you, and nothing else.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
            </GlassCard>
          </PressableScale>
        </Appear>
      ) : null}

      <Appear delay={180}>
        <GlassCard style={styles.leave}>
          <Text style={styles.leaveTitle}>Leaving this team</Text>
          <Text style={styles.leaveCopy}>
            Your coach stops being able to see anything of yours straight away. Everything you
            logged stays yours and stays in your account.
          </Text>
          <Button label="Leave team" icon="exit-outline" variant="danger" onPress={onLeave} />
        </GlassCard>
      </Appear>
    </>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.limeSoft,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '800', color: palette.text },
  copy: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
  leave: { gap: 10 },
  leaveTitle: { fontSize: 14, fontWeight: '800', color: palette.text },
  leaveCopy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
});
