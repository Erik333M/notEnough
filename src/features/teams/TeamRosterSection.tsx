import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RosterEntry } from '../../api/teams';
import { SectionHeader } from '../../ui/Controls';
import { RosterRow } from './RosterRow';

/**
 * Who is in the team, and the one-tap way to add them as a friend.
 *
 * The friend affordance belongs here rather than on the friends screen: these
 * are the people you actually train with, their names are already in front of
 * you, and asking someone to recite a six-character code while standing next
 * to you would be silly. It exposes nothing new, because the roster was
 * already visible to every member.
 */
export const TeamRosterSection = memo(function TeamRosterSection({
  roster,
  currentUserId,
  friendStateFor,
  onAddFriend,
}: {
  roster: RosterEntry[];
  currentUserId: string | undefined;
  friendStateFor: (userId: string) => 'none' | 'pending' | 'friends';
  onAddFriend: (userId: string, name: string) => void;
}) {
  return (
    <>
      <SectionHeader title="Roster" meta={`${roster.length} in this team`} />
      <View style={styles.list}>
        {roster.map((entry) => (
          <RosterRow
            key={entry.userId}
            entry={entry}
            isYou={entry.userId === currentUserId}
            friendState={friendStateFor(entry.userId)}
            onAddFriend={() => onAddFriend(entry.userId, entry.name)}
          />
        ))}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  list: { gap: 10 },
});
