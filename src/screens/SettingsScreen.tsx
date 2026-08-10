import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ensureNotificationPermission,
  resyncReminders,
  scheduledCount,
} from '../notifications/notifications';
import { API_BASE_URL } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { useActions, useAppState, useSync } from '../state/DataContext';
import { palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, Pill, SectionHeader } from '../ui/Controls';
import { Field } from '../ui/Field';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';

const SYNC_LABEL = {
  idle: 'Ready',
  syncing: 'Syncing',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync failed',
} as const;

export default function SettingsScreen({ bottomInset }: { bottomInset: number }) {
  const { user, rename, logout, deleteAccount, offline } = useAuth();
  const state = useAppState();
  const sync = useSync();
  const { clearToday } = useActions();
  const { notify } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    let cancelled = false;
    scheduledCount().then((count) => {
      if (!cancelled) setScheduled(count);
    });
    return () => {
      cancelled = true;
    };
  }, [state?.goals]);

  const handleRename = useCallback(async () => {
    if (name.trim().length < 2) {
      notify('Name needs at least 2 characters.', 'error');
      return;
    }
    setSavingName(true);
    const result = await rename(name);
    setSavingName(false);
    notify(result.ok ? 'Profile updated.' : result.message, result.ok ? 'success' : 'error');
  }, [name, notify, rename]);

  const handleResync = useCallback(async () => {
    if (!state) return;
    setSyncing(true);
    const granted = await ensureNotificationPermission();
    if (!granted) {
      setSyncing(false);
      notify('Notifications are turned off in system settings.', 'error');
      return;
    }
    await resyncReminders(state.goals);
    setScheduled(await scheduledCount());
    setSyncing(false);
    notify('Reminders re-synced.', 'success');
  }, [notify, state]);

  const handleClearToday = useCallback(() => {
    Alert.alert('Clear today?', 'This wipes every goal amount logged today.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearToday();
          notify("Today's progress cleared.", 'info');
        },
      },
    ]);
  }, [clearToday, notify]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'Your profile, goals and history are removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteAccount() },
      ],
    );
  }, [deleteAccount]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Appear>
        <GlassCard style={styles.stack} elevated>
          <SectionHeader title="Profile" meta={user?.email} />
          <Field label="Display name" value={name} onChangeText={setName} icon="person-outline" autoCapitalize="words" />
          <Button
            label={savingName ? 'Saving…' : 'Save profile'}
            icon="checkmark"
            variant="glass"
            loading={savingName}
            onPress={handleRename}
          />
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={palette.textFaint} />
            <Text style={styles.metaText}>
              Member since{' '}
              {user ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </Text>
          </View>
        </GlassCard>
      </Appear>

      <Appear delay={60}>
        <GlassCard style={styles.stack}>
          <SectionHeader
            title="Notifications"
            meta="Local reminders, no account needed"
            action={
              <Pill
                label={scheduled === null ? '—' : `${scheduled} live`}
                icon="notifications"
                accent={scheduled ? 'lime' : 'rose'}
              />
            }
          />
          <Text style={styles.copy}>
            Reminders are scheduled on the device for each goal you enable. If you change the system
            time zone or reinstall the app, re-sync to rebuild the schedule.
          </Text>
          <Button
            label={syncing ? 'Syncing…' : 'Re-sync reminders'}
            icon="sync"
            variant="glass"
            loading={syncing}
            onPress={handleResync}
          />
        </GlassCard>
      </Appear>

      <Appear delay={90}>
        <GlassCard style={styles.stack}>
          <SectionHeader
            title="Server"
            meta="Goals and history sync to your account"
            action={
              <Pill
                label={offline ? 'Offline' : SYNC_LABEL[sync.status]}
                icon={offline ? 'cloud-offline' : 'cloud-done'}
                accent={offline || sync.status === 'error' ? 'amber' : 'lime'}
              />
            }
          />
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Endpoint</Text>
            <Text style={styles.kvValue} numberOfLines={1}>
              {API_BASE_URL}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Last sync</Text>
            <Text style={styles.kvValue}>
              {sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleTimeString() : 'Not yet'}
            </Text>
          </View>
          <Text style={styles.copy}>
            Changes are saved on the device first and pushed in the background, so the app keeps
            working with no connection and catches up when there is one.
          </Text>
          <Button label="Sync now" icon="cloud-upload-outline" variant="glass" onPress={sync.syncNow} />
        </GlassCard>
      </Appear>

      <Appear delay={130}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Data" meta="Cached locally, owned by your account" />
          <Button label="Clear today's progress" icon="refresh" variant="glass" onPress={handleClearToday} />
          <Button label="Sign out" icon="log-out-outline" variant="glass" onPress={() => void logout()} />
          <Button label="Delete account" icon="trash-outline" variant="danger" onPress={handleDelete} />
        </GlassCard>
      </Appear>

      <Appear delay={170}>
        <GlassCard style={styles.about}>
          <Text style={styles.aboutTitle}>NOTenough</Text>
          <Text style={styles.copy}>
            Good is the starting line. Every time a target becomes comfortable, the app raises it.
          </Text>
          <Text style={styles.version}>Version 1.1 • Expo SDK 57</Text>
        </GlassCard>
      </Appear>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  stack: {
    gap: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: palette.textFaint,
    fontWeight: '600',
  },
  copy: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.textMuted,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kvKey: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textFaint,
    width: 78,
  },
  kvValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
  },
  about: {
    gap: 8,
    borderRadius: radius.lg,
  },
  aboutTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
  },
  version: {
    fontSize: 11,
    color: palette.textFaint,
    fontWeight: '700',
  },
});
