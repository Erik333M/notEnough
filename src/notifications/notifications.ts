import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Goal } from '../state/types';
import { GOAL_UNIT } from '../state/types';

/**
 * Local goal reminders.
 *
 * These are *scheduled local* notifications, which still work in Expo Go.
 * (Remote/push notifications were removed from Expo Go on Android in SDK 53 —
 * those would need a development build. We don't use them.)
 */

const CHANNEL_ID = 'goal-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let permissionPromise: Promise<boolean> | null = null;

/** Idempotent: repeated calls share one in-flight permission request. */
export function ensureNotificationPermission(): Promise<boolean> {
  if (permissionPromise) return permissionPromise;

  permissionPromise = (async () => {
    if (Platform.OS === 'web') return false;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Goal reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 220, 120, 220],
          lightColor: '#8B6BFF',
        });
      }

      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;

      const next = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      return next.granted;
    } catch {
      return false;
    }
  })();

  return permissionPromise;
}

function reminderBody(goal: Goal): string {
  if (goal.kind === 'check') return 'Tick it off before the day gets away from you.';
  return `Target: ${goal.target} ${GOAL_UNIT[goal.kind]}. Start now, finish strong.`;
}

/**
 * Schedules a repeating daily reminder and returns its identifier.
 * Returns null when permission is denied or the platform has no support.
 */
export async function scheduleGoalReminder(goal: Goal): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: goal.title,
        body: reminderBody(goal),
        sound: true,
        data: { goalId: goal.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: goal.reminder.hour,
        minute: goal.reminder.minute,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* already gone */
  }
}

/**
 * Rebuilds every scheduled reminder from the current goal list.
 * Called on sign-in so the OS schedule can never drift from app state
 * (e.g. after a reinstall, timezone change, or an OS-side purge).
 */
export async function resyncReminders(
  goals: Goal[],
): Promise<Record<string, string | null> | null> {
  const active = goals.filter((g) => !g.archived && g.reminder.enabled);
  if (active.length === 0) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      /* noop */
    }
    return {};
  }

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* noop */
  }

  const entries = await Promise.all(
    active.map(async (goal) => [goal.id, await scheduleGoalReminder(goal)] as const),
  );
  return Object.fromEntries(entries);
}

export async function scheduledCount(): Promise<number> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.length;
  } catch {
    return 0;
  }
}
