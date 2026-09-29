import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RosterEntry } from '../../api/teams';
import { radius } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { Pill, RoundIconButton } from '../../ui/Controls';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * One person on the roster.
 *
 * Name, face and role. The server never sends an email address here, so there
 * is nothing else to show even if a screen wanted to — joining a squad is not
 * consent to hand your address to everyone else who scanned the same code.
 */
export const RosterRow = memo(function RosterRow({
  entry,
  isYou = false,
  friendState,
  onAddFriend,
}: {
  entry: RosterEntry;
  isYou?: boolean;
  /** Undefined while unknown; drives which affordance the row offers. */
  friendState?: 'none' | 'pending' | 'friends';
  onAddFriend?: () => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const coach = entry.role === 'coach';

  return (
    <View style={styles.row}>
      <Avatar name={entry.name} uri={entry.avatarUrl} size={34} />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
          {isYou ? <Text style={styles.you}>  you</Text> : null}
        </Text>
        {entry.status === 'pending' ? <Text style={styles.pending}>Invite not accepted yet</Text> : null}
      </View>

      {/*
        Adding someone you already share a roster with exposes nothing new —
        their name is on this screen already — and it saves reciting six
        characters at a person standing next to you.
      */}
      {!isYou && onAddFriend && friendState === 'none' ? (
        <RoundIconButton
          icon="person-add-outline"
          size={34}
          onPress={onAddFriend}
          accessibilityLabel={`Add ${entry.name} as a friend`}
        />
      ) : null}
      {!isYou && friendState === 'pending' ? (
        <Ionicons name="hourglass-outline" size={15} color={theme.textFaint} />
      ) : null}
      {!isYou && friendState === 'friends' ? (
        <Ionicons
          name="people"
          size={15}
          color={theme.accent.body}
          accessibilityLabel="Already a friend"
        />
      ) : null}

      {coach ? (
        <Pill label="Coach" icon="clipboard-outline" accent="spirit" />
      ) : (
        <Ionicons name="barbell-outline" size={15} color={theme.accent.mind} />
      )}
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: theme.text },
  you: { fontSize: 11, fontWeight: '700', color: theme.textFaint },
  pending: { fontSize: 11, fontWeight: '600', color: theme.warning },
});
