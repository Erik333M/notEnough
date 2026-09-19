import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Squad } from '../../api/events';
import { accentColor, palette } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { RoundIconButton } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { GlassCard } from '../../ui/Glass';

/**
 * One squad inside an event.
 *
 * Shows who is in it and, for staff, the two things they will actually want:
 * take somebody out, and get rid of the squad. Adding happens from the
 * unassigned list above, because that is where the person you are placing is.
 */
export const SquadCard = memo(function SquadCard({
  squad,
  canManage,
  busy,
  onRemove,
  onRename,
  onDisband,
}: {
  squad: Squad;
  canManage: boolean;
  busy: string | null;
  onRemove: (userId: string) => void;
  onRename: (name: string) => void;
  onDisband: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(squad.team.name);
  const [confirming, setConfirming] = useState(false);

  return (
    <GlassCard style={styles.card}>
      {editing ? (
        <View style={styles.rename}>
          <Field label="Squad name" value={name} onChangeText={setName} icon="flag-outline" />
          <View style={styles.renameRow}>
            <Button
              label="Save"
              onPress={() => {
                onRename(name.trim());
                setEditing(false);
              }}
              disabled={name.trim().length === 0}
              style={styles.grow}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setName(squad.team.name);
                setEditing(false);
              }}
              style={styles.grow}
            />
          </View>
        </View>
      ) : (
        <View style={styles.head}>
          <Text style={styles.name} numberOfLines={1}>
            {squad.team.name}
          </Text>
          <Text style={styles.count}>
            {squad.members.length} {squad.members.length === 1 ? 'person' : 'people'}
          </Text>
          {canManage ? (
            <RoundIconButton
              icon="create-outline"
              size={32}
              onPress={() => setEditing(true)}
              accessibilityLabel={`Rename ${squad.team.name}`}
            />
          ) : null}
        </View>
      )}

      {squad.members.length === 0 ? (
        <Text style={styles.empty}>Nobody in it yet.</Text>
      ) : (
        squad.members.map((member) => (
          <View key={member.userId} style={styles.row}>
            <Avatar name={member.name} uri={member.avatarUrl} size={30} />
            <Text style={styles.member} numberOfLines={1}>
              {member.name}
            </Text>
            {member.role === 'coach' ? <Text style={styles.leads}>leads</Text> : null}
            {canManage ? (
              <RoundIconButton
                icon="close"
                size={30}
                onPress={() => onRemove(member.userId)}
                accessibilityLabel={`Take ${member.name} out of ${squad.team.name}`}
              />
            ) : null}
          </View>
        ))
      )}

      {canManage ? (
        confirming ? (
          <View style={styles.renameRow}>
            {/*
              Disbanding is not deleting anybody. Saying so on the button is
              cheaper than an organiser finding out by trying it.
            */}
            <Button
              label="Disband — they stay at the camp"
              variant="danger"
              loading={busy === squad.team.id}
              onPress={onDisband}
              style={styles.grow}
            />
            <Button label="Keep" variant="ghost" onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <Button label="Disband squad" variant="ghost" onPress={() => setConfirming(true)} />
        )
      ) : null}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 15, fontWeight: '800', color: palette.text },
  count: { fontSize: 11.5, fontWeight: '700', color: palette.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  member: { flex: 1, fontSize: 13.5, fontWeight: '700', color: palette.text },
  leads: { fontSize: 10.5, fontWeight: '800', color: accentColor.violet, textTransform: 'uppercase' },
  empty: { fontSize: 12, fontWeight: '600', color: palette.textFaint },
  rename: { gap: 10 },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
});
