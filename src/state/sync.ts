import { api, type RemoteState } from '../api/client';
import { migrate } from './defaults';
import type { AppState } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export type SyncOutcome =
  | { kind: 'adopt'; state: AppState }
  | { kind: 'pushed'; updatedAt: number }
  | { kind: 'unchanged' }
  | { kind: 'offline' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

function toRemote(state: AppState) {
  return {
    version: state.version,
    goals: state.goals,
    log: state.log,
    runs: state.runs,
    plan: state.plan,
    updatedAt: state.updatedAt,
  };
}

function fromRemote(remote: RemoteState): AppState {
  const state = migrate(remote);
  return { ...state, updatedAt: Number(remote.updatedAt) || Date.now() };
}

/**
 * Reconcile local state with the server.
 *
 * The rule is last-write-wins on `updatedAt`, decided in one place:
 *  - server has nothing yet  → push (first sync for this account)
 *  - server copy is newer    → adopt it (another device got there first)
 *  - local copy is newer     → push
 *  - equal                   → nothing to do
 *
 * A 409 means the server moved between our read and our write, so we take the
 * server's copy rather than retrying — retrying a stale write is how sync
 * layers silently destroy data.
 */
export async function reconcile(token: string, local: AppState): Promise<SyncOutcome> {
  const pulled = await api.pullState(token);

  if (!pulled.ok) {
    if (pulled.error.kind === 'offline') return { kind: 'offline' };
    if (pulled.error.status === 401) return { kind: 'unauthorized' };
    return { kind: 'error', message: pulled.error.message };
  }

  const remote = pulled.data.state;

  if (remote && Number(remote.updatedAt) > local.updatedAt) {
    return { kind: 'adopt', state: fromRemote(remote) };
  }

  if (remote && Number(remote.updatedAt) === local.updatedAt) {
    return { kind: 'unchanged' };
  }

  return push(token, local);
}

export async function push(token: string, local: AppState): Promise<SyncOutcome> {
  const pushed = await api.pushState(token, toRemote(local));

  if (pushed.ok) return { kind: 'pushed', updatedAt: pushed.data.state.updatedAt };

  if (pushed.error.kind === 'offline') return { kind: 'offline' };
  if (pushed.error.status === 401) return { kind: 'unauthorized' };

  if (pushed.error.status === 409) {
    const fresh = await api.pullState(token);
    if (fresh.ok && fresh.data.state) return { kind: 'adopt', state: fromRemote(fresh.data.state) };
    return { kind: 'error', message: 'Could not resolve a sync conflict.' };
  }

  return { kind: 'error', message: pushed.error.message };
}
