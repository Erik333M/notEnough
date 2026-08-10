import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoalCard } from '../features/goals/GoalCard';
import { GoalEditor } from '../features/goals/GoalEditor';
import { dayKey } from '../lib/time';
import { GOAL_TEMPLATES } from '../state/defaults';
import { useActions, useAppState, type GoalDraft } from '../state/DataContext';
import type { Goal } from '../state/types';
import { accentColor, accentSoft, palette, radius } from '../theme/theme';
import { PressableScale } from '../ui/Touchable';
import { Button } from '../ui/Button';
import { Appear, Pill, SectionHeader, StatTile } from '../ui/Controls';
import { EmptyState, SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';

export default function GoalsScreen({ bottomInset }: { bottomInset: number }) {
  const state = useAppState();
  const { addGoal, updateGoal, deleteGoal, setReminder, addProgress, completeGoal } = useActions();
  const { notify } = useToast();

  const [editing, setEditing] = useState<Goal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const today = dayKey();
  const goals = useMemo(() => state?.goals.filter((g) => !g.archived) ?? [], [state]);
  const reminderCount = useMemo(() => goals.filter((g) => g.reminder.enabled).length, [goals]);

  const openNew = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback(
    (goalId: string) => {
      const goal = goals.find((g) => g.id === goalId) ?? null;
      setEditing(goal);
      setSheetOpen(true);
    },
    [goals],
  );

  const handleSave = useCallback(
    (draft: GoalDraft) => {
      if (editing) {
        // Reminder goes through `setReminder` so the OS schedule is rebuilt;
        // the rest is a plain state patch.
        updateGoal(editing.id, {
          title: draft.title,
          detail: draft.detail,
          kind: draft.kind,
          target: draft.target,
          accent: draft.accent,
          icon: draft.icon,
        });
        setReminder(editing.id, draft.reminder, {
          title: draft.title,
          detail: draft.detail,
          kind: draft.kind,
          target: draft.target,
        });
        notify('Goal updated.', 'success');
      } else {
        addGoal(draft);
        notify(
          draft.reminder.enabled ? 'Goal created — reminder scheduled.' : 'Goal created.',
          'success',
        );
      }
    },
    [addGoal, editing, notify, setReminder, updateGoal],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteGoal(id);
      notify('Goal deleted.', 'info');
    },
    [deleteGoal, notify],
  );

  const addTemplate = useCallback(
    (index: number) => {
      const template = GOAL_TEMPLATES[index];
      if (goals.some((g) => g.title.toLowerCase() === template.title.toLowerCase())) {
        notify(`"${template.title}" is already on your board.`, 'info');
        return;
      }
      addGoal(template);
      notify(`${template.title} added.`, 'success');
    },
    [addGoal, goals, notify],
  );

  if (!state) {
    return (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonCard />
        <SkeletonCard delay={140} />
      </ScrollView>
    );
  }

  const todayLog = state.log[today];

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        <Appear>
          <GlassCard style={styles.summary} elevated>
            <View style={styles.summaryTop}>
              <View style={{ flex: 1, gap: 6 }}>
                <Pill label="Goal board" icon="flag" accent="violet" />
                <Text style={styles.summaryTitle}>
                  {goals.length === 0
                    ? 'Nothing tracked yet'
                    : `${goals.length} goal${goals.length === 1 ? '' : 's'} on repeat`}
                </Text>
                <Text style={styles.summaryCopy}>
                  {reminderCount === 0
                    ? 'No reminders scheduled. Turn one on so the day cannot slip.'
                    : `${reminderCount} daily reminder${reminderCount === 1 ? '' : 's'} scheduled.`}
                </Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <StatTile value={`${goals.length}`} label="Goals" accent="violet" />
              <StatTile value={`${reminderCount}`} label="Reminders" accent="cyan" />
              <StatTile
                value={`${goals.filter((g) => (todayLog?.[g.id] ?? 0) >= g.target).length}`}
                label="Closed today"
                accent="lime"
              />
            </View>

            <Button label="New goal" icon="add" onPress={openNew} />
          </GlassCard>
        </Appear>

        <Appear delay={50}>
          <GlassCard style={styles.stack}>
            <SectionHeader title="Quick add" meta="One tap, fully editable after" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateRow}
            >
              {GOAL_TEMPLATES.map((template, index) => (
                <TemplateChip
                  key={template.title}
                  index={index}
                  title={template.title}
                  icon={template.icon}
                  accent={template.accent}
                  onPress={addTemplate}
                />
              ))}
            </ScrollView>
          </GlassCard>
        </Appear>

        <Appear delay={70}>
          <SectionHeader title="Your goals" meta="Tap a card to edit" />
        </Appear>

        {goals.length === 0 ? (
          <GlassCard>
            <EmptyState
              icon="flag-outline"
              title="Start with one goal"
              copy="One repeatable target beats five you will abandon by Thursday."
            />
          </GlassCard>
        ) : (
          goals.map((goal, index) => (
            <Appear key={goal.id} delay={90 + index * 45}>
              <GoalCard
                goal={goal}
                amount={todayLog?.[goal.id] ?? 0}
                onAdd={addProgress}
                onComplete={completeGoal}
                onPress={openEdit}
                delay={index * 60}
              />
            </Appear>
          ))
        )}
      </ScrollView>

      <GoalEditor
        visible={sheetOpen}
        goal={editing}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  );
}

const TemplateChip = memo(function TemplateChip({
  index,
  title,
  icon,
  accent,
  onPress,
}: {
  index: number;
  title: string;
  icon: Goal['icon'];
  accent: Goal['accent'];
  onPress: (index: number) => void;
}) {
  return (
    <PressableScale onPress={() => onPress(index)} haptic="medium" scaleTo={0.93}>
      <View style={[styles.template, { borderColor: `${accentColor[accent]}44` }]}>
        <View style={[styles.templateIcon, { backgroundColor: accentSoft[accent] }]}>
          <Ionicons name={icon} size={15} color={accentColor[accent]} />
        </View>
        <Text style={styles.templateText} numberOfLines={1}>
          {title}
        </Text>
        <Ionicons name="add" size={14} color={palette.textFaint} />
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  stack: {
    gap: 14,
  },
  templateRow: {
    gap: 10,
    paddingRight: 4,
  },
  template: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.glassSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  templateIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
  },
  summary: {
    gap: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: palette.text,
  },
  summaryCopy: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.textFaint,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
