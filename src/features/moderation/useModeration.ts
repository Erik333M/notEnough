import { useCallback, useEffect, useRef, useState } from 'react';

import {
  moderationApi,
  type BlockedPerson,
  type ReportKind,
  type ReportReason,
} from '../../api/moderation';
import { useAuth } from '../../state/AuthContext';

/**
 * Blocking and reporting, from anywhere that shows somebody else's words.
 *
 * `onChanged` is how a feed or a channel knows to re-read itself. Blocking
 * hides content server-side, so the list on screen is stale the instant it
 * succeeds — and a report that visibly does nothing is worse than no report
 * button at all.
 */
export function useModeration(onChanged?: () => void) {
  const { token } = useAuth();
  const [blocks, setBlocks] = useState<BlockedPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const result = await moderationApi.blocks(token);
    if (mounted.current && result.ok) setBlocks(result.data.blocks);
  }, [token]);

  const block = useCallback(
    async (userId: string) => {
      if (!token) return { ok: false as const, message: 'Sign in first.' };
      setBusy(true);
      const result = await moderationApi.block(token, userId);
      if (result.ok) {
        await refresh();
        onChanged?.();
      }
      if (!mounted.current) return { ok: false as const, message: '' };
      setBusy(false);
      return result.ok
        ? { ok: true as const, message: '' }
        : { ok: false as const, message: result.error.message };
    },
    [onChanged, refresh, token],
  );

  const unblock = useCallback(
    async (userId: string) => {
      if (!token) return;
      setBusy(true);
      await moderationApi.unblock(token, userId);
      await refresh();
      onChanged?.();
      if (mounted.current) setBusy(false);
    },
    [onChanged, refresh, token],
  );

  const report = useCallback(
    async (
      kind: ReportKind,
      targetUserId: string,
      reason: ReportReason,
      note: string,
      alsoBlock: boolean,
      targetId?: string,
    ) => {
      if (!token) return { ok: false as const, message: 'Sign in first.' };
      setBusy(true);
      const result = await moderationApi.report(token, {
        kind,
        targetUserId,
        targetId,
        reason,
        note,
        block: alsoBlock,
      });
      if (result.ok) {
        await refresh();
        onChanged?.();
      }
      if (!mounted.current) return { ok: false as const, message: '' };
      setBusy(false);
      return result.ok
        ? { ok: true as const, message: '' }
        : { ok: false as const, message: result.error.message };
    },
    [onChanged, refresh, token],
  );

  return { blocks, busy, refresh, block, unblock, report };
}
