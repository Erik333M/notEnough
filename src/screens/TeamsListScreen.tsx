import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EventsSection } from '../features/events/EventsSection';
import { TeamRow } from '../features/teams/TeamRow';
import { useEvents } from '../features/events/useEvents';
import { useTeams } from '../state/TeamsContext';
import { palette, radius } from '../theme/theme';
import { Appear, SectionHeader } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';

/**
 * The root of the Teams tab: every team you are in, whichever side of the
 * roster you are on.
 *
 * One screen rather than a coach screen and an athlete screen. A coach in one
 * squad and an athlete in another is an ordinary situation, not an edge case,
 * and giving each role its own destination would force that person to
 * remember which door leads where. The row says which you are; opening it
 * shows you the right thing.
 */
export default function TeamsListScreen({
  bottomInset,
  initialAction,
  onOpenTeam,
  onOpenEvent,
}: {
  bottomInset: number;
  /** Set when the opening question sent someone straight here to act. */
  initialAction?: 'join' | 'create';
  onOpenTeam: (teamId: string) => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const { capabilities, memberships, error, refresh, createTeam, joinTeam } = useTeams();
  const events = useEvents();
  const { notify } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'join' | 'create' | null>(null);
  // Both forms start closed. Most opens of this screen are to look at a team,
  // not to make one, so the lists stay at the top where the eye lands.
  const [open, setOpen] = useState<'join' | 'create' | null>(initialAction ?? null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), events.refresh()]);
    setRefreshing(false);
  }, [events, refresh]);

  const handleJoin = useCallback(async () => {
    setBusy('join');
    const result = await joinTeam(code);
    setBusy(null);
    if (result.ok) {
      setCode('');
      setOpen(null);
      notify(`You joined ${result.team.name}.`, 'success');
    } else {
      notify(result.message, 'error');
    }
  }, [code, joinTeam, notify]);

  const handleCreate = useCallback(async () => {
    setBusy('create');
    const result = await createTeam(name.trim());
    setBusy(null);
    if (result.ok) {
      setName('');
      setOpen(null);
      notify(`${result.team.name} created. You are its coach.`, 'success');
      onOpenTeam(result.team.id);
    } else {
      notify(result.message, 'error');
    }
  }, [createTeam, name, notify, onOpenTeam]);

  // Events count as belonging to something. Somebody running a camp and no
  // squad should not be told they have joined nothing.
  const empty =
    !capabilities.loading && !events.loading && memberships.length === 0 && events.events.length === 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.textMuted} />
        }
      >
        {error ? (
          <View style={styles.notice}>
            <Ionicons name="cloud-offline-outline" size={15} color={palette.amber} />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : null}

        {empty ? (
          <Appear>
            <EmptyState
              icon="people-outline"
              title="No teams yet"
              copy="Join one with a code from your coach, or start your own. Everything you already track stays yours either way."
            />
          </Appear>
        ) : null}

        <Appear>
          <EventsSection
            events={events.events}
            onOpenEvent={onOpenEvent}
            onCreate={async (input) => {
              const result = await events.create(input);
              return result.ok
                ? { ok: true, id: result.created.event.id }
                : { ok: false, message: result.message };
            }}
          />
        </Appear>

        {memberships.length > 0 ? (
          <Appear>
            <SectionHeader title="Your teams" meta={`${memberships.length} in total`} />
            <View style={styles.list}>
              {memberships.map(({ team, role }) => (
                <TeamRow key={team.id} team={team} role={role} onOpen={() => onOpenTeam(team.id)} />
              ))}
            </View>
          </Appear>
        ) : null}

        <Appear delay={80}>
          <View style={styles.actions}>
            {open === 'join' ? (
              <GlassCard style={styles.form}>
                <Text style={styles.formTitle}>Join a team</Text>
                <Text style={styles.formCopy}>
                  Your coach gives you a six-character code. Letters and numbers only — it is not
                  case sensitive.
                </Text>
                <Field
                  label="Invite code"
                  value={code}
                  onChangeText={setCode}
                  placeholder="e.g. 7KDP2M"
                  icon="key-outline"
                  autoCapitalize="characters"
                  returnKeyType="go"
                  onSubmitEditing={handleJoin}
                />
                <Button
                  label="Join"
                  icon="enter-outline"
                  loading={busy === 'join'}
                  disabled={code.trim().length < 6}
                  onPress={handleJoin}
                />
                <Button label="Cancel" variant="ghost" onPress={() => setOpen(null)} />
              </GlassCard>
            ) : null}

            {open === 'create' ? (
              <GlassCard style={styles.form}>
                <Text style={styles.formTitle}>Create a team</Text>
                <Text style={styles.formCopy}>
                  You become its coach. Athletes join with a code you share — you never create
                  accounts for them, and you only ever see the work you set.
                </Text>
                <Field
                  label="Team name"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Thursday squad"
                  icon="people-outline"
                  autoCapitalize="words"
                  returnKeyType="go"
                  onSubmitEditing={handleCreate}
                />
                <Button
                  label="Create team"
                  icon="add"
                  loading={busy === 'create'}
                  disabled={name.trim().length < 2}
                  onPress={handleCreate}
                />
                <Button label="Cancel" variant="ghost" onPress={() => setOpen(null)} />
              </GlassCard>
            ) : null}

            {open === null ? (
              <>
                <Button label="Join a team" icon="key-outline" variant="glass" onPress={() => setOpen('join')} />
                <Button label="Create a team" icon="add" variant="glass" onPress={() => setOpen('create')} />
              </>
            ) : null}
          </View>
        </Appear>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, gap: 16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,183,77,0.10)',
  },
  noticeText: { flex: 1, fontSize: 12, fontWeight: '600', color: palette.amber },
  list: { gap: 10 },
  actions: { gap: 10 },
  form: { gap: 12, padding: 16 },
  formTitle: { fontSize: 16, fontWeight: '800', color: palette.text },
  formCopy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
});
