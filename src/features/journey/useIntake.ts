import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../../state/AuthContext';
import { emptyIntake } from '../../state/journey/factory';
import {
  clearIntake,
  intakeAnswered,
  loadIntake,
  saveIntake,
  skipIntake,
} from '../../state/journey/intake';
import type { Intake } from '../../state/journey/types';

/**
 * Loads and stores the baseline questionnaire for the signed-in user.
 *
 * Kept apart from `DataContext` deliberately. Intake holds injuries, medical
 * conditions and an emergency contact, and the whole point of storing it under
 * its own SecureStore key is that it never joins the synced `AppState` blob —
 * routing it through the same provider would be the first step to it leaking
 * there. Nothing in this file logs a field value.
 *
 * `status` is three-state because "not asked yet" and "asked and skipped" have
 * to be told apart: the first should show onboarding, the second must not.
 */
export type IntakeStatus = 'loading' | 'needed' | 'answered';

export function useIntake() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [intake, setIntake] = useState<Intake>(emptyIntake);
  const [status, setStatus] = useState<IntakeStatus>('loading');

  // Guards against a slow read for a previous account landing after a switch.
  const activeUser = useRef<string | null>(null);

  useEffect(() => {
    activeUser.current = userId;
    if (!userId) {
      setIntake(emptyIntake());
      setStatus('loading');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    void loadIntake(userId).then((loaded) => {
      if (cancelled || activeUser.current !== userId) return;
      setIntake(loaded);
      setStatus(intakeAnswered(loaded) ? 'answered' : 'needed');
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    async (next: Intake) => {
      if (!userId) return;
      const stamped: Intake = { ...next, completedAt: Date.now(), skipped: false };
      setIntake(stamped);
      setStatus('answered');
      await saveIntake(userId, stamped);
    },
    [userId],
  );

  /** Records that the user was asked and declined, storing no answers. */
  const skip = useCallback(async () => {
    if (!userId) return;
    setStatus('answered');
    const skipped = await skipIntake(userId);
    setIntake(skipped);
  }, [userId]);

  /** Withdraws the data entirely. Irreversible, and meant to be. */
  const withdraw = useCallback(async () => {
    if (!userId) return;
    setIntake(emptyIntake());
    setStatus('answered');
    await clearIntake(userId);
  }, [userId]);

  return { intake, status, save, skip, withdraw };
}
