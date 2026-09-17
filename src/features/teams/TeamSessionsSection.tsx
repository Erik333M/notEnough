import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Session } from '../../api/teams';
import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/Controls';
import { EmptyState } from '../../ui/Feedback';
import { GlassCard } from '../../ui/Glass';
import { SessionRow } from './SessionRow';

/**
 * The sessions a team has, from whichever side of the roster you are on.
 *
 * Same list, different sentence: a coach is told what to do next, an athlete
 * is told this is where their work will appear. One component rather than two
 * screens, because it is one list.
 */
export const TeamSessionsSection = memo(function TeamSessionsSection({
  sessions,
  isCoach,
  onOpen,
  onCreate,
}: {
  sessions: Session[];
  isCoach: boolean;
  onOpen: (sessionId: string) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <SectionHeader
        title="Sessions"
        meta={isCoach ? 'What you have set' : 'What your coach has set'}
      />

      {sessions.length === 0 ? (
        <GlassCard style={styles.empty}>
          <EmptyState
            icon="calendar-outline"
            title="No sessions yet"
            copy={
              isCoach
                ? 'Create one, add a few tasks, then hand it to the squad.'
                : 'Nothing has been set for you yet. It will appear here.'
            }
          />
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} onPress={() => onOpen(session.id)} />
          ))}
        </View>
      )}

      {isCoach ? (
        <View style={styles.actions}>
          <Button label="New session" icon="add" variant="glass" onPress={onCreate} />
        </View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  empty: { paddingVertical: 8 },
  list: { gap: 10 },
  actions: { marginTop: 10 },
});
