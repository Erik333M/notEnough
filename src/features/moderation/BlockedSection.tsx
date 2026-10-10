import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { useModeration } from './useModeration';

/**
 * Who you have blocked, and the way back.
 *
 * A block that cannot be undone is a trap rather than a control, and the
 * place somebody looks for it is Settings — not the feed where they pressed
 * it, which by then no longer shows that person at all.
 *
 * The section hides itself when the list is empty. Most people will never
 * block anybody, and an empty "Blocked" heading on everybody's settings
 * screen implies a problem the app does not have.
 */
export const BlockedSection = memo(function BlockedSection() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const moderation = useModeration();

  useEffect(() => {
    void moderation.refresh();
    // Once, on open. The list only changes from this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (moderation.blocks.length === 0) return null;

  return (
    <GlassCard style={styles.card}>
      <SectionHeader
        title="Blocked"
        meta={`${moderation.blocks.length} ${moderation.blocks.length === 1 ? 'person' : 'people'}`}
      />
      <Text style={styles.copy}>
        Neither of you sees the other. Nothing either of you recorded was deleted, and unblocking
        brings it all back.
      </Text>

      {moderation.blocks.map((person) => (
        <View key={person.userId} style={styles.row}>
          <Avatar name={person.name} uri={person.avatarUrl} size={32} />
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          <Button
            label="Unblock"
            variant="ghost"
            loading={moderation.busy}
            onPress={() => void moderation.unblock(person.userId)}
          />
        </View>
      ))}

      <View style={styles.note}>
        <Ionicons name="flag-outline" size={13} color={theme.textFaint} />
        <Text style={styles.noteText}>
          Anything you reported was sent with it. Reports are kept even if the account goes.
        </Text>
      </View>
    </GlassCard>
  );
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: 12, padding: 16 },
    copy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: theme.textMuted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.text },
    note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    noteText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '600', color: theme.textFaint },
  });
