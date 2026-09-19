import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { StatField } from '../../api/event-stats';
import { accentColor, palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, Segmented } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { GlassCard } from '../../ui/Glass';

/**
 * What this event counts — and the screen where the organiser decides.
 *
 * The app ships no opinion about goals or yellow cards. Somebody running a
 * football camp types "Goals", somebody running a swimming one types
 * "Lengths", and the entry screens rebuild themselves around whatever is here.
 *
 * Two things are fixed, and both are explained in place rather than enforced
 * silently: a field counts either a team or a person, and one field decides
 * who won.
 */
export const StatFieldsCard = memo(function StatFieldsCard({
  fields,
  busy,
  onAdd,
  onRename,
  onDrop,
}: {
  fields: StatField[];
  busy: string | null;
  onAdd: (label: string, scope: 'team' | 'player') => void;
  onRename: (fieldId: string, label: string) => void;
  onDrop: (fieldId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<'team' | 'player'>('player');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <GlassCard style={styles.card}>
      {fields.map((field) =>
        editing === field.id ? (
          <View key={field.id} style={styles.editing}>
            <Field label="Name" value={draft} onChangeText={setDraft} icon="pricetag-outline" />
            <View style={styles.editRow}>
              <Button
                label="Save"
                disabled={draft.trim().length === 0}
                loading={busy === field.id}
                onPress={() => {
                  onRename(field.id, draft.trim());
                  setEditing(null);
                }}
                style={styles.grow}
              />
              <Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} style={styles.grow} />
            </View>
          </View>
        ) : (
          <View key={field.id} style={styles.row}>
            <Ionicons
              name={field.scope === 'team' ? 'people-outline' : 'person-outline'}
              size={15}
              color={field.scope === 'team' ? accentColor.cyan : accentColor.violet}
            />
            <View style={styles.body}>
              <Text style={styles.label} numberOfLines={1}>
                {field.label}
              </Text>
              <Text style={styles.scope}>
                {field.scope === 'team' ? 'Per squad' : 'Per person'}
                {field.isScore ? ' · decides who wins' : ''}
              </Text>
            </View>

            <RoundIconButton
              icon="create-outline"
              size={30}
              onPress={() => {
                setDraft(field.label);
                setEditing(field.id);
              }}
              accessibilityLabel={`Rename ${field.label}`}
            />
            {/*
              The result field has no remove button rather than one that
              refuses: an affordance that always fails is worse than none.
            */}
            {field.isScore ? null : (
              <RoundIconButton
                icon="trash-outline"
                size={30}
                onPress={() => onDrop(field.id)}
                accessibilityLabel={`Stop counting ${field.label}`}
              />
            )}
          </View>
        ),
      )}

      {adding ? (
        <View style={styles.editing}>
          <Field
            label="What do you want to count?"
            value={label}
            onChangeText={setLabel}
            placeholder="Assists"
            icon="add-circle-outline"
          />
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'player', label: 'Per person' },
              { value: 'team', label: 'Per squad' },
            ]}
          />
          <Text style={styles.hint}>
            Per person gives you a leaderboard for it. Per squad is one number for the whole side.
          </Text>
          <View style={styles.editRow}>
            <Button
              label="Add it"
              disabled={label.trim().length === 0}
              loading={busy === 'field'}
              onPress={() => {
                onAdd(label.trim(), scope);
                setLabel('');
                setAdding(false);
              }}
              style={styles.grow}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setAdding(false)} style={styles.grow} />
          </View>
        </View>
      ) : (
        <Button label="Count something else" icon="add" variant="ghost" onPress={() => setAdding(true)} />
      )}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  body: { flex: 1, gap: 1 },
  label: { fontSize: 13.5, fontWeight: '800', color: palette.text },
  scope: { fontSize: 11, fontWeight: '600', color: palette.textFaint },
  editing: { gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: palette.glass },
  editRow: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  hint: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: palette.textFaint },
});
