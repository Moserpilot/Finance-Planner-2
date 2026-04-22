// app/lib/sync.ts
// All sync logic — last-write-wins with safety backup before any overwrite.

export const SYNC_BACKUP_KEY = 'fp_pre_sync_backup';
export const LAST_SYNCED_KEY = 'fp_last_synced';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline' | 'error';

export type SyncResult =
  | { status: 'pushed';   message: string }
  | { status: 'pulled';   message: string; plan: unknown }
  | { status: 'in_sync';  message: string }
  | { status: 'error';    message: string }
  | { status: 'no_data';  message: string };

// ─── fetch with a hard timeout ──────────────────────────────────────────────

async function fetchTimeout(url: string, init?: RequestInit, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

// ─── push plan to server ─────────────────────────────────────────────────────

async function pushToServer(plan: unknown, serverUrl: string): Promise<boolean> {
  try {
    const res = await fetchTimeout(`${serverUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── main sync function ──────────────────────────────────────────────────────

export async function syncPlan(localPlan: any, serverUrl: string): Promise<SyncResult> {
  try {
    const res = await fetchTimeout(`${serverUrl}/api/sync`);

    // No remote data yet — only push if local has real data (has a savedAt stamp)
    if (res.status === 404) {
      if (!localPlan?.savedAt) {
        // Local is a fresh default plan — nothing worth pushing yet
        return { status: 'no_data', message: 'No data on server yet.' };
      }
      const ok = await pushToServer(localPlan, serverUrl);
      if (!ok) return { status: 'error', message: 'Could not reach sync server.' };
      setLastSynced();
      return { status: 'pushed', message: 'Plan uploaded to sync server.' };
    }

    if (!res.ok) {
      return { status: 'error', message: `Server responded with ${res.status}.` };
    }

    const remotePlan: any = await res.json();

    // Compare timestamps — treat missing savedAt as epoch 0
    const localMs  = localPlan?.savedAt  ? new Date(localPlan.savedAt).getTime()  : 0;
    const remoteMs = remotePlan?.savedAt ? new Date(remotePlan.savedAt).getTime() : 0;
    const nowMs    = Date.now();
    const FUTURE_GRACE = 5 * 60_000; // 5 minutes

    // Guard: if either timestamp is more than 5 minutes in the future, it's bogus —
    // treat it as 0 so the real (non-bogus) side wins.
    const localEffectiveMs  = localMs  > nowMs + FUTURE_GRACE ? 0 : localMs;
    const remoteEffectiveMs = remoteMs > nowMs + FUTURE_GRACE ? 0 : remoteMs;

    if (localEffectiveMs === remoteEffectiveMs) {
      setLastSynced();
      return { status: 'in_sync', message: 'Already in sync.' };
    }

    // If local has no real timestamp (never saved, or bogus future date), always pull
    if (localEffectiveMs === 0) {
      if (typeof window !== 'undefined' && localPlan) {
        localStorage.setItem(
          SYNC_BACKUP_KEY,
          JSON.stringify({ plan: localPlan, backedUpAt: new Date().toISOString() })
        );
      }
      setLastSynced();
      return { status: 'pulled', message: 'Downloaded plan from server.', plan: remotePlan };
    }

    if (localEffectiveMs > remoteEffectiveMs) {
      // Local is newer — push to server
      const ok = await pushToServer(localPlan, serverUrl);
      if (!ok) return { status: 'error', message: 'Could not push to sync server.' };
      setLastSynced();
      return { status: 'pushed', message: 'Your changes were uploaded.' };
    }

    // Remote is newer — back up local first, then return remote plan
    if (typeof window !== 'undefined' && localPlan) {
      localStorage.setItem(
        SYNC_BACKUP_KEY,
        JSON.stringify({ plan: localPlan, backedUpAt: new Date().toISOString() })
      );
    }
    setLastSynced();
    return { status: 'pulled', message: 'Newer version downloaded.', plan: remotePlan };

  } catch (e: any) {
    const msg = e?.name === 'AbortError'
      ? 'Sync server not reachable (timeout).'
      : e?.message || 'Unknown sync error.';
    return { status: 'error', message: msg };
  }
}

// ─── force push — re-stamps local plan with NOW and pushes to server ─────────
// Use this on the desktop to reset a corrupted/stuck sync state.

export async function forcePushToServer(localPlan: any, serverUrl: string): Promise<SyncResult> {
  try {
    // Stamp a fresh real timestamp so the server and phone will treat this as authoritative
    const freshPlan = { ...localPlan, savedAt: new Date().toISOString() };
    // Save the fresh timestamp to local storage too, so future auto-syncs stay in sync
    if (typeof window !== 'undefined') {
      const current = localStorage.getItem('finance_planner_plan_v2');
      if (current) {
        const parsed = JSON.parse(current);
        localStorage.setItem('finance_planner_plan_v2', JSON.stringify({ ...parsed, savedAt: freshPlan.savedAt }));
      }
    }
    const ok = await pushToServer(freshPlan, serverUrl);
    if (!ok) return { status: 'error', message: 'Could not reach sync server.' };
    setLastSynced();
    return { status: 'pushed', message: 'Your data was uploaded. Now sync your phone.' };
  } catch (e: any) {
    return { status: 'error', message: e?.message || 'Unknown error.' };
  }
}

// ─── force pull — always downloads from server, ignores timestamps ────────────
// Use this on the phone to grab whatever the desktop last uploaded.

export async function forcePullFromServer(serverUrl: string): Promise<SyncResult> {
  try {
    const res = await fetchTimeout(`${serverUrl}/api/sync`);
    if (res.status === 404) {
      return { status: 'no_data', message: 'No data on server yet. Go to desktop Settings and tap "Upload my data" first.' };
    }
    if (!res.ok) {
      return { status: 'error', message: `Server responded with ${res.status}.` };
    }
    const remotePlan: any = await res.json();
    if (!remotePlan || typeof remotePlan !== 'object' || !remotePlan.income) {
      return { status: 'error', message: 'Server data looks empty or corrupt. Try uploading from desktop first.' };
    }
    // Back up current local plan before overwriting
    if (typeof window !== 'undefined') {
      const currentRaw = localStorage.getItem('finance_planner_plan_v2');
      if (currentRaw) {
        localStorage.setItem(
          SYNC_BACKUP_KEY,
          JSON.stringify({ plan: JSON.parse(currentRaw), backedUpAt: new Date().toISOString() })
        );
      }
    }
    setLastSynced();
    return { status: 'pulled', message: 'Latest data downloaded from desktop.', plan: remotePlan };
  } catch (e: any) {
    const msg = e?.name === 'AbortError'
      ? 'Server not reachable (timeout).'
      : e?.message || 'Unknown error.';
    return { status: 'error', message: msg };
  }
}

// ─── ping (just checks if the server is up) ──────────────────────────────────

export async function pingServer(serverUrl: string): Promise<boolean> {
  try {
    const res = await fetchTimeout(`${serverUrl}/api/sync`, undefined, 4000);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function setLastSynced() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
  }
}

export function getLastSynced(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_SYNCED_KEY);
}

export function getPreSyncBackup(): { plan: unknown; backedUpAt: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SYNC_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPreSyncBackup() {
  if (typeof window !== 'undefined') localStorage.removeItem(SYNC_BACKUP_KEY);
}

/** Format "2 min ago", "just now", etc. */
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10)  return 'just now';
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
