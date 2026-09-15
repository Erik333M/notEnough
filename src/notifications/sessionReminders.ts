import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Assignment } from '../api/teams';
import { notificationsSupported, ensureNotificationPermission } from './notifications';
import { planReminders, reminderBody, reminderDate } from './reminderPlan';

/**
 * A reminder on the morning of a session you have been set.
 *
 * These are *local* notifications, scheduled on the athlete's own device from
 * work already fetched. Nothing is pushed: no token is collected, no server
 * sends anyone a message, and the privacy policy's promise on that stays true.
 *
 * The trade-off is honest and worth naming — a coach handing out work while
 * your phone is in a locker cannot ring it. The reminder appears once the app
 * has seen the assignment, which in practice means the next time you open it.
 * Making that instant would need a push service, an infrastructure and privacy
 * decision well beyond a reminder.
 */
export const SESSION_CHANNEL_ID = 'session-reminders';

/** Marks our own notifications so a resync can cancel these and only these. */
const KIND = 'session';

/**
 * Rebuilds the session reminders from the current assignment list.
 *
 * Cancels only its own — matched by the `kind` it stamps on each one — so a
 * resync here can never take out the daily goal reminders scheduled elsewhere.
 */
export async function syncSessionReminders(
  assignments: Assignment[],
  today: string,
): Promise<number> {
  if (!notificationsSupported()) return 0;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((entry) => entry.content.data?.kind === KIND)
        .map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier)),
    );
  } catch {
    // A failed cancel must not stop the reschedule; the worst case is a stale
    // reminder, which is better than none at all.
  }

  const plans = planReminders(assignments, today);
  if (plans.length === 0) return 0;

  const granted = await ensureNotificationPermission();
  if (!granted) return 0;

  // Its own Android channel, so a user who wants session reminders but not
  // daily goal nudges can silence one without losing the other.
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(SESSION_CHANNEL_ID, {
        name: 'Session reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor: '#3FE0E8',
      });
    } catch {
      /* the schedule below still works on the default channel */
    }
  }

  let scheduledCount = 0;
  for (const plan of plans) {
    const when = reminderDate(plan.date);
    if (!when) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Training today',
          body: reminderBody(plan),
          sound: true,
          data: { kind: KIND, sessionId: plan.sessionId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          ...(Platform.OS === 'android' ? { channelId: SESSION_CHANNEL_ID } : {}),
        },
      });
      scheduledCount += 1;
    } catch {
      /* one failure should not abandon the rest */
    }
  }

  return scheduledCount;
}
