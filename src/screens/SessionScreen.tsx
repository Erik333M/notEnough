import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TaskKind } from '../api/teams';
import { AddTaskSheet } from '../features/teams/AddTaskSheet';
import { AthleteProgressCard } from '../features/teams/AthleteProgressCard';
import { ShareResultsCard } from '../features/teams/ShareResultsCard';
import { useSessionActions } from '../features/teams/useSessionActions';
import { TaskRow } from '../features/teams/TaskRow';
import { nameFor, useSessionDetail } from '../features/teams/useTeamData';
import { longDateLabel } from '../lib/time';
import { useAuth } from '../state/AuthContext';
import { palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, SectionHeader } from '../ui/Controls';
import { EmptyState, SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { StackHeaderBar } from '../ui/StackHeaderBar';
import { useToast } from '../ui/Toast';

/**
 * One session: what is in it, who has it, and how it is going.
 *
 * A coach builds the task list, hands it to the squad, and reads the results
 * grouped by athlete. An athlete sees their own rows and logs against them.
 * Both are the same screen because they are the same object seen from two
 * sides — and the server decides which rows come back, so the client never has
 * to work out what it is allowed to ask for.
 */
export default function SessionScreen({
  teamId,
  sessionId,
  bottomInset,
  onBack,
}: {
  teamId: string;
  sessionId: string;
  bottomInset: number;
  onBack: () => void;
}) {
  const { token, user } = useAuth();
  const { data, loading, error, reload } = useSessionDetail(teamId, sessionId);
  const { notify } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const { addTask, removeTask, handOut, setShared, toggleDone, handingOut } = useSessionActions(
    sessionId,
    reload,
  );

  const isCoach = data?.role === 'coach';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  /** Assignments grouped by the person doing them, so the grid reads by athlete. */
  const byAthlete = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, typeof data.assignments>();
    for (const row of data.assignments) {
      const list = groups.get(row.assigneeUserId) ?? [];
      list.push(row);
      groups.set(row.assigneeUserId, list);
    }
    return [...groups.entries()]
      .map(([userId, rows]) => ({ userId, name: nameFor(data.roster, userId), rows }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const handedOut = (data?.assignments.length ?? 0) > 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.textMuted} />
      }
    >
      <StackHeaderBar
        title={data?.session.name ?? 'Session'}
        meta={data?.session.date ? longDateLabel(data.session.date) : undefined}
        onBack={onBack}
        backLabel="Back to the team"
      />

      {loading ? <SkeletonCard /> : null}
      {error ? (
        <View style={styles.notice}>
          <Ionicons name="cloud-offline-outline" size={15} color={palette.amber} />
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      {data ? (
        <>
          <Appear>
            <SectionHeader
              title="Tasks"
              meta={isCoach ? 'What the squad is being asked to do' : 'What you have been asked to do'}
            />
            {data.tasks.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <EmptyState
                  icon="list-outline"
                  title="Nothing in this session yet"
                  copy={
                    isCoach
                      ? 'Add a task or two, then hand the session to your squad.'
                      : 'Your coach has not filled this in yet.'
                  }
                />
              </GlassCard>
            ) : (
              <View style={styles.list}>
                {data.tasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={index}
                    onRemove={isCoach ? () => void removeTask(task.id) : undefined}
                  />
                ))}
              </View>
            )}

            {isCoach ? (
              <View style={styles.actions}>
                <Button label="Add task" icon="add" variant="glass" onPress={() => setAdding(true)} />
                <Button
                  label={handedOut ? 'Hand out again' : 'Hand out to the squad'}
                  icon="send-outline"
                  loading={handingOut}
                  disabled={data.tasks.length === 0}
                  onPress={() => void handOut(data.roster)}
                />
                {handedOut ? (
                  <Text style={styles.hint}>
                    Handing out again only adds what is missing — nobody gets a duplicate, and
                    nothing already logged is disturbed.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Appear>

          {isCoach ? (
            <Appear delay={60}>
              <ShareResultsCard
                shared={data.session.shareResults}
                onChange={(next) => void setShared(next)}
              />
            </Appear>
          ) : null}

          <Appear delay={120}>
            <SectionHeader
              title="Progress"
              meta={isCoach ? `${byAthlete.length} with this session` : 'How you are doing'}
            />
            {byAthlete.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <EmptyState
                  icon="hourglass-outline"
                  title={isCoach ? 'Not handed out yet' : 'Nothing assigned to you yet'}
                  copy={
                    isCoach
                      ? 'Once you hand this session out, everyone’s progress shows up here.'
                      : 'Your coach has not sent you this session yet.'
                  }
                />
              </GlassCard>
            ) : (
              <View style={styles.list}>
                {byAthlete.map((group) => (
                  <AthleteProgressCard
                    key={group.userId}
                    name={group.name}
                    isYou={group.userId === user?.id}
                    assignments={group.rows}
                    onToggleDone={
                      group.userId === user?.id ? (row) => void toggleDone(row) : undefined
                    }
                  />
                ))}
              </View>
            )}
          </Appear>
        </>
      ) : null}

      <AddTaskSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={async (input) => {
          if (await addTask(input)) setAdding(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  actions: { marginTop: 10, gap: 10 },
  hint: { fontSize: 11.5, lineHeight: 16.5, fontWeight: '600', color: palette.textFaint },
  emptyCard: { paddingVertical: 8 },
});
