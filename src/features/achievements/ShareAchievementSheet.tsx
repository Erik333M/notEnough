import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Team, TeamRole } from '../../api/teams';
import { accentColor, palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader } from '../../ui/Controls';
import { TextArea } from '../../ui/Field';
import type { Achievement } from './derive';
import type { Audience } from './useSharing';

/**
 * Publish one achievement to one team.
 *
 * The whole point of this sheet is the paragraph in the middle. Most of these
 * are read out of training a coach cannot otherwise see — a benchmark best
 * comes from your own log — so sharing one hands over something that was
 * private a moment ago. A button labelled only "Share" would not be telling
 * the truth about that.
 *
 * So it shows the exact words that will appear, names who they go to, and says
 * plainly that this reveals those lines and no more. One audience at a time,
 * deliberately: "post everywhere" is how people share to an audience they had
 * forgotten they had.
 *
 * Your friends are one of those audiences, alongside each team. An audience
 * that already has this achievement is shown as taken rather than hidden, so
 * it reads as "already done" instead of as a missing option.
 */
export function ShareAchievementSheet({
  achievement,
  teams,
  friendCount,
  takenTeamIds,
  friendsTaken,
  onClose,
  onShare,
}: {
  achievement: Achievement | null;
  teams: { team: Team; role: TeamRole }[];
  /** Zero means no friends yet, so the option is not offered at all. */
  friendCount: number;
  /** Teams that already have this achievement. */
  takenTeamIds: Set<string>;
  friendsTaken: boolean;
  onClose: () => void;
  onShare: (audience: Audience, note: string) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const [target, setTarget] = useState<Audience | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const open = teams.filter((row) => !takenTeamIds.has(row.team.id));
  const friendsOpen = friendCount > 0 && !friendsTaken;

  useEffect(() => {
    if (!achievement) return;
    setNote('');
    // Pre-selected only when there is no choice to make.
    const only =
      open.length === 1 && !friendsOpen
        ? ({ kind: 'team', id: open[0].team.id } as Audience)
        : open.length === 0 && friendsOpen
          ? ({ kind: 'friends' } as Audience)
          : null;
    setTarget(only);
    // `open` is derived from props that change together with the achievement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement, teams, friendCount, friendsTaken]);

  const submit = useCallback(async () => {
    if (!target) return;
    setBusy(true);
    const ok = await onShare(target, note.trim());
    setBusy(false);
    if (ok) onClose();
  }, [note, onClose, onShare, target]);

  const chosen =
    target?.kind === 'friends'
      ? 'your friends'
      : teams.find((row) => row.team.id === (target?.kind === 'team' ? target.id : null))?.team.name;

  return (
    <Modal
      visible={achievement != null}
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
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            {achievement ? (
              <>
                <SectionHeader
                  title="Share this"
                  meta="One team, and only what you see below"
                  action={
                    <RoundIconButton
                      icon="close"
                      size={34}
                      onPress={onClose}
                      accessibilityLabel="Close"
                    />
                  }
                />

                <View style={styles.preview}>
                  <Ionicons
                    name={achievement.icon}
                    size={18}
                    color={accentColor[achievement.accent]}
                  />
                  <View style={styles.previewBody}>
                    <Text style={styles.previewTitle}>{achievement.title}</Text>
                    <Text style={styles.previewDetail}>{achievement.detail}</Text>
                  </View>
                </View>

                <Text style={styles.warning}>
                  {chosen
                    ? `${target?.kind === 'friends' ? 'Everyone you have added as a friend' : `Everyone in ${chosen}`} will see those two lines, your name and the date. Nothing else — not your journal, your goals, or anything you have not shared.`
                    : 'Whoever you pick will see those two lines, your name and the date. Nothing else — not your journal, your goals, or anything you have not shared.'}
                </Text>

                <View style={styles.block}>
                  <Text style={styles.label}>SHARE WITH</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                  >
                    {friendCount > 0 ? (
                      <Chip
                        label={friendsTaken ? 'Friends · shared' : 'Your friends'}
                        active={target?.kind === 'friends'}
                        onPress={() => !friendsTaken && setTarget({ kind: 'friends' })}
                        accent="violet"
                      />
                    ) : null}
                    {teams.map(({ team }) => {
                      const taken = takenTeamIds.has(team.id);
                      return (
                        <Chip
                          key={team.id}
                          label={taken ? `${team.name} · shared` : team.name}
                          active={target?.kind === 'team' && target.id === team.id}
                          onPress={() => !taken && setTarget({ kind: 'team', id: team.id })}
                          accent="cyan"
                        />
                      );
                    })}
                  </ScrollView>
                </View>

                <TextArea
                  label="Say something (optional)"
                  value={note}
                  onChangeText={setNote}
                  placeholder="How it went"
                  maxLength={240}
                />

                <Button
                  label={chosen ? `Share with ${chosen}` : 'Pick who sees it'}
                  icon="share-outline"
                  loading={busy}
                  disabled={!target}
                  onPress={submit}
                />

                <Text style={styles.note}>You can take it down again at any time.</Text>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,3,10,0.72)' },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    gap: 14,
    padding: 18,
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  previewBody: { flex: 1, gap: 2 },
  previewTitle: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  previewDetail: { fontSize: 12.5, fontWeight: '600', color: palette.textMuted },
  warning: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  block: { gap: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: palette.textFaint },
  chips: { gap: 8, paddingRight: 8 },
  note: { fontSize: 11.5, fontWeight: '600', color: palette.textFaint, textAlign: 'center' },
});
