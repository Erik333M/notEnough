import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RosterEntry } from '../../api/teams';
import { addDays, dayKey } from '../../lib/time';
import { accentColor, palette, radius } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader, Stepper } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { GlassCard } from '../../ui/Glass';
import { useToast } from '../../ui/Toast';
import { PressableScale } from '../../ui/Touchable';
import { formatDay } from './eventCopy';
import { useStaffRota } from './useStaffRota';

/**
 * Who is doing what, among the people running the event.
 *
 * Staff only — campers never see this section, because the work endpoint never
 * sends them anybody else's rows and there is nothing here for them anyway.
 *
 * A job belongs to one person and only that person can tick it off. That is
 * the server's rule, not a choice this screen makes, so the tick appears only
 * on your own rows; on everybody else's you see whether it is done and nothing
 * you can press.
 */
export const StaffRotaSection = memo(function StaffRotaSection({
  teamId,
  roster,
}: {
  teamId: string;
  roster: RosterEntry[];
}) {
  const rota = useStaffRota(teamId, roster);
  const { notify } = useToast();
  const [giving, setGiving] = useState(false);
  const [title, setTitle] = useState('');
  const [who, setWho] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const dueDate = dayKey(addDays(new Date(`${dayKey()}T00:00:00`), offset));
  const nameOf = (userId: string) => roster.find((row) => row.userId === userId)?.name ?? 'Unknown';

  const report = async (result: { ok: boolean; message: string }) => {
    if (!result.ok && result.message) notify(result.message, 'error');
    return result.ok;
  };

  if (rota.loading) return null;

  const outstanding = rota.jobs.filter((job) => !job.result?.done).length;

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="Staff jobs"
        meta={outstanding > 0 ? `${outstanding} outstanding` : undefined}
      />

      {rota.jobs.length === 0 && !giving ? (
        <Text style={styles.blurb}>
          Hand out the jobs that keep the event running. Each one belongs to one person, who is the
          one who ticks it off.
        </Text>
      ) : null}

      {rota.jobs.map((job) => {
        const done = Boolean(job.result?.done);
        const mine = job.assigneeUserId === rota.myId;
        const member = roster.find((row) => row.userId === job.assigneeUserId);

        return (
          <GlassCard key={job.id} style={styles.job}>
            {mine ? (
              <PressableScale
                haptic="light"
                onPress={async () => report(await rota.tick(job.id, !done))}
                accessibilityLabel={done ? `Mark ${job.title} not done` : `Mark ${job.title} done`}
              >
                <View style={[styles.box, done && styles.boxDone]}>
                  {done ? <Ionicons name="checkmark" size={15} color={palette.onAccent} /> : null}
                </View>
              </PressableScale>
            ) : (
              <View style={[styles.box, styles.boxQuiet, done && styles.boxDone]}>
                {done ? <Ionicons name="checkmark" size={15} color={palette.onAccent} /> : null}
              </View>
            )}

            <View style={styles.body}>
              <Text style={[styles.title, done && styles.struck]} numberOfLines={2}>
                {job.title}
              </Text>
              <View style={styles.meta}>
                <Avatar name={member?.name ?? '?'} uri={member?.avatarUrl} size={18} />
                <Text style={styles.who} numberOfLines={1}>
                  {mine ? 'You' : nameOf(job.assigneeUserId)} · {formatDay(job.dueDate)}
                </Text>
              </View>
            </View>

            <RoundIconButton
              icon="trash-outline"
              size={30}
              onPress={async () => report(await rota.withdraw(job.id))}
              accessibilityLabel={`Call off ${job.title}`}
            />
          </GlassCard>
        );
      })}

      {giving ? (
        <GlassCard style={styles.form}>
          <Field
            label="What needs doing?"
            value={title}
            onChangeText={setTitle}
            placeholder="Set the hall up before nine"
            icon="checkbox-outline"
          />

          <Text style={styles.label}>Who is doing it?</Text>
          <View style={styles.choices}>
            {rota.staff.map((person) => (
              <Chip
                key={person.userId}
                label={person.userId === rota.myId ? `${person.name} (you)` : person.name}
                active={who === person.userId}
                onPress={() => setWho(person.userId)}
              />
            ))}
          </View>

          <Stepper
            label="Due"
            value={offset}
            display={offset === 0 ? 'Today' : formatDay(dueDate)}
            onChange={setOffset}
            min={0}
            max={365}
          />

          <View style={styles.formRow}>
            <Button
              label="Give it out"
              loading={rota.busy === 'give'}
              disabled={title.trim().length === 0 || !who}
              onPress={async () => {
                if (!who) return;
                if (await report(await rota.give(who, title.trim(), dueDate))) {
                  setTitle('');
                  setGiving(false);
                }
              }}
              style={styles.grow}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setGiving(false)} style={styles.grow} />
          </View>
        </GlassCard>
      ) : (
        <Button
          label="Give somebody a job"
          icon="add"
          variant="ghost"
          onPress={() => {
            setWho(rota.staff[0]?.userId ?? null);
            setGiving(true);
          }}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  blurb: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  job: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  boxQuiet: { borderColor: 'rgba(255,255,255,0.10)' },
  boxDone: { backgroundColor: accentColor.lime, borderColor: accentColor.lime },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '700', color: palette.text },
  struck: { color: palette.textFaint, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  who: { flex: 1, fontSize: 11.5, fontWeight: '600', color: palette.textMuted },
  form: { gap: 12, padding: 14, borderRadius: radius.md },
  label: { fontSize: 11.5, fontWeight: '800', color: palette.textFaint, textTransform: 'uppercase' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formRow: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
});
