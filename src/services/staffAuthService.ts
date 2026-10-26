/**
 * Staff Authentication & Google Sheets Security Service
 * IGNOU Study Centre 2033
 * 
 * Manages staff accounts, authentication against Google Sheets (Staff_Users tab),
 * resilient offline fallback caching, 5-attempt progressive lockout, and account governance.
 */

export interface StaffUser {
  staffId: string;
  fullName: string;
  role: 'ADMIN' | 'OFFICIAL';
  password: string;
  status: 'Active' | 'Locked' | 'Suspended';
  failedAttempts: number;
  lockoutUntil?: number; // timestamp ms
  lastLogin?: string;
  createdAt?: string;
}

const STORAGE_KEY = 'ignou_sc2033_staff_accounts';
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const DEFAULT_STAFF_ACCOUNTS: StaffUser[] = [
  {
    staffId: 'coordinator',
    fullName: 'Dr. Sant Kumar Gupta (Centre Coordinator)',
    role: 'ADMIN',
    password: 'Coordinator@2033',
    status: 'Active',
    failedAttempts: 0,
    createdAt: '2026-07-01T09:00:00.000Z',
  },
  {
    staffId: 'desk01',
    fullName: 'Counter 1 Desk Official',
    role: 'OFFICIAL',
    password: 'Desk@2033',
    status: 'Active',
    failedAttempts: 0,
    createdAt: '2026-07-01T09:00:00.000Z',
  },
  {
    staffId: 'desk02',
    fullName: 'Counter 2 Desk Official',
    role: 'OFFICIAL',
    password: 'Desk@2033',
    status: 'Active',
    failedAttempts: 0,
    createdAt: '2026-07-01T09:00:00.000Z',
  },
];

/**
 * Retrieves the local staff accounts cache from localStorage, falling back to defaults.
 */
export function getLocalStaffAccounts(): StaffUser[] {
  if (typeof window === 'undefined') return DEFAULT_STAFF_ACCOUNTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure default coordinator always exists
        const hasCoordinator = parsed.some(
          (u: any) => String(u.staffId || '').toLowerCase() === 'coordinator'
        );
        if (!hasCoordinator) {
          parsed.unshift(DEFAULT_STAFF_ACCOUNTS[0]);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed reading staff accounts from localStorage:', err);
  }
  // Initialize storage with defaults
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STAFF_ACCOUNTS));
  } catch {}
  return DEFAULT_STAFF_ACCOUNTS;
}

/**
 * Persists the staff accounts array to localStorage.
 */
export function saveLocalStaffAccounts(accounts: StaffUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Error saving staff accounts to localStorage:', err);
  }
}

/**
 * Synchronizes staff accounts from Google Sheets (or the Express store).
 */
export async function syncStaffFromSheet(
  scriptUrl?: string
): Promise<{ success: boolean; count: number; accounts: StaffUser[]; source: 'google_sheets' | 'local_cache' }> {
  const currentLocal = getLocalStaffAccounts();

  try {
    const url = scriptUrl
      ? `/api/sheets?scriptUrl=${encodeURIComponent(scriptUrl)}`
      : '/api/sheets';

    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      const json = await resp.json();
      const rawUsers =
        json.staffUsers ||
        json.Staff_Users ||
        json.staff_users ||
        json.staff ||
        [];

      if (Array.isArray(rawUsers) && rawUsers.length > 0) {
        const mappedUsers: StaffUser[] = rawUsers.map((r: any) => {
          const staffId = String(r.Staff_ID || r.staffId || r.username || r.id || '').trim().toLowerCase();
          const fullName = String(r.Full_Name || r.fullName || r.name || staffId).trim();
          const roleRaw = String(r.Role || r.role || 'OFFICIAL').trim().toUpperCase();
          const role: 'ADMIN' | 'OFFICIAL' = roleRaw === 'ADMIN' ? 'ADMIN' : 'OFFICIAL';
          const password = String(r.Password || r.password || '').trim();
          const statusRaw = String(r.Account_Status || r.status || 'Active').trim();
          const status: 'Active' | 'Locked' | 'Suspended' =
            statusRaw.toLowerCase() === 'locked'
              ? 'Locked'
              : statusRaw.toLowerCase() === 'suspended'
              ? 'Suspended'
              : 'Active';
          const failedAttempts = Number(r.Failed_Attempts || r.failedAttempts || 0);
          const lastLogin = r.Last_Login || r.lastLogin || undefined;

          return {
            staffId,
            fullName,
            role,
            password,
            status,
            failedAttempts: isNaN(failedAttempts) ? 0 : failedAttempts,
            lastLogin,
          };
        }).filter((u: StaffUser) => Boolean(u.staffId));

        if (mappedUsers.length > 0) {
          // Merge with local accounts
          const remoteMap = new Map(mappedUsers.map((u) => [u.staffId, u]));
          const merged: StaffUser[] = mappedUsers.slice();

          // Retain local accounts if not yet in sheet
          currentLocal.forEach((loc) => {
            if (!remoteMap.has(loc.staffId)) {
              merged.push(loc);
            }
          });

          saveLocalStaffAccounts(merged);
          return {
            success: true,
            count: merged.length,
            accounts: merged,
            source: 'google_sheets',
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[Staff Sync] Remote Google Sheets fetch failed, using local cache:', err.message);
  }

  return {
    success: true,
    count: currentLocal.length,
    accounts: currentLocal,
    source: 'local_cache',
  };
}

/**
 * Primary Authentication: Validates credentials in real-time with Google Sheets,
 * seamlessly falling back to local cached credentials if offline.
 */
export async function authenticateStaff(
  inputStaffId: string,
  inputPass: string,
  scriptUrl?: string
): Promise<{
  success: boolean;
  user?: StaffUser;
  error?: string;
  remainingAttempts?: number;
  locked?: boolean;
  lockoutRemainingMinutes?: number;
  source?: 'google_sheets' | 'local_cache';
}> {
  const cleanId = (inputStaffId || '').trim().toLowerCase();
  const enteredPass = (inputPass || '').trim();

  if (!cleanId || !enteredPass) {
    return { success: false, error: 'Please enter both Staff ID and Password.' };
  }

  // 1. Check local lock state first
  const accounts = getLocalStaffAccounts();
  const targetIndex = accounts.findIndex((u) => u.staffId.toLowerCase() === cleanId);
  const localUser = targetIndex >= 0 ? accounts[targetIndex] : null;

  const now = Date.now();
  if (localUser && localUser.status === 'Locked') {
    if (localUser.lockoutUntil && localUser.lockoutUntil > now) {
      const remainingMinutes = Math.ceil((localUser.lockoutUntil - now) / 60000);
      return {
        success: false,
        locked: true,
        lockoutRemainingMinutes: remainingMinutes,
        error: `Account is locked due to ${LOCKOUT_THRESHOLD} failed attempts. Cooldown remaining: ${remainingMinutes} minute(s). Contact Coordinator to unlock.`,
      };
    } else if (localUser.lockoutUntil && localUser.lockoutUntil <= now) {
      // Cooldown expired; auto-unlock
      localUser.status = 'Active';
      localUser.failedAttempts = 0;
      localUser.lockoutUntil = undefined;
      saveLocalStaffAccounts(accounts);
    }
  }

  // 2. Attempt real-time authentication via Google Apps Script proxy
  let remoteVerified = false;
  let remoteUser: any = null;

  try {
    const resp = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'VERIFY_STAFF_LOGIN',
        staffId: cleanId,
        password: enteredPass,
        scriptUrl,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.status === 'success' && data.user) {
        remoteVerified = true;
        remoteUser = data.user;
      } else if (data && data.status === 'locked') {
        return {
          success: false,
          locked: true,
          error: data.message || 'Account is locked in Google Sheets. Contact Coordinator.',
        };
      }
    }
  } catch (netErr: any) {
    console.info('[Auth] Google Sheets verification offline or timed out. Falling back to local credentials cache.', netErr.message);
  }

  // 3. Evaluate results
  if (remoteVerified && remoteUser) {
    // Update local user with remote success
    const updatedUser: StaffUser = {
      staffId: cleanId,
      fullName: remoteUser.fullName || remoteUser.Full_Name || localUser?.fullName || cleanId,
      role: (remoteUser.role || remoteUser.Role || localUser?.role || 'OFFICIAL').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'OFFICIAL',
      password: enteredPass,
      status: 'Active',
      failedAttempts: 0,
      lastLogin: new Date().toISOString(),
    };

    if (targetIndex >= 0) {
      accounts[targetIndex] = updatedUser;
    } else {
      accounts.push(updatedUser);
    }
    saveLocalStaffAccounts(accounts);

    // Ensure Last_Login timestamp is synchronized in Google Sheets
    notifyRemoteStatusUpdate(cleanId, 'Active', 0, scriptUrl);

    return {
      success: true,
      user: updatedUser,
      source: 'google_sheets',
    };
  }

  // 4. Offline Fallback Authentication
  if (!localUser) {
    return {
      success: false,
      error: `Staff ID '${cleanId}' not recognized. Please check with Centre Coordinator.`,
    };
  }

  if (localUser.status === 'Suspended') {
    return {
      success: false,
      error: 'This account has been suspended by the Centre Coordinator.',
    };
  }

  // Match password
  if (localUser.password === enteredPass) {
    localUser.failedAttempts = 0;
    localUser.status = 'Active';
    localUser.lockoutUntil = undefined;
    localUser.lastLogin = new Date().toISOString();
    saveLocalStaffAccounts(accounts);

    // Asynchronously update status to sheet
    notifyRemoteStatusUpdate(cleanId, 'Active', 0, scriptUrl);

    return {
      success: true,
      user: localUser,
      source: 'local_cache',
    };
  }

  // Password Mismatch: Record failed attempt
  localUser.failedAttempts = (localUser.failedAttempts || 0) + 1;
  const remaining = Math.max(0, LOCKOUT_THRESHOLD - localUser.failedAttempts);

  let isNowLocked = false;
  if (localUser.failedAttempts >= LOCKOUT_THRESHOLD) {
    localUser.status = 'Locked';
    localUser.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    isNowLocked = true;
  }

  saveLocalStaffAccounts(accounts);

  // Notify remote sheet of failed attempt
  notifyRemoteStatusUpdate(
    cleanId,
    isNowLocked ? 'Locked' : 'Active',
    localUser.failedAttempts,
    scriptUrl
  );

  if (isNowLocked) {
    return {
      success: false,
      locked: true,
      lockoutRemainingMinutes: 15,
      error: `Security Lockout: Account locked after ${LOCKOUT_THRESHOLD} consecutive failed attempts. Contact Dr. Sant Kumar Gupta to unlock.`,
    };
  }

  return {
    success: false,
    remainingAttempts: remaining,
    error: `Incorrect password. ${remaining} attempt(s) remaining before security lockout.`,
  };
}

/**
 * Unlocks a locked staff account. Can be executed by the Coordinator.
 */
export async function unlockStaffAccount(
  staffId: string,
  scriptUrl?: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = (staffId || '').trim().toLowerCase();
  const accounts = getLocalStaffAccounts();
  const target = accounts.find((u) => u.staffId.toLowerCase() === cleanId);

  if (!target) {
    return { success: false, message: `Account '${cleanId}' not found.` };
  }

  target.status = 'Active';
  target.failedAttempts = 0;
  target.lockoutUntil = undefined;
  saveLocalStaffAccounts(accounts);

  // Update in Google Sheets
  notifyRemoteStatusUpdate(cleanId, 'Active', 0, scriptUrl);

  return { success: true, message: `Staff account '${cleanId}' has been successfully unlocked.` };
}

/**
 * Creates or updates a staff user account.
 */
export async function saveStaffUser(
  user: StaffUser,
  scriptUrl?: string
): Promise<{ success: boolean; message: string }> {
  const accounts = getLocalStaffAccounts();
  const cleanId = user.staffId.trim().toLowerCase();
  const existingIdx = accounts.findIndex((u) => u.staffId.toLowerCase() === cleanId);

  const updated: StaffUser = {
    ...user,
    staffId: cleanId,
    role: user.role === 'ADMIN' ? 'ADMIN' : 'OFFICIAL',
    status: user.status || 'Active',
    failedAttempts: user.failedAttempts || 0,
  };

  if (existingIdx >= 0) {
    accounts[existingIdx] = updated;
  } else {
    accounts.push(updated);
  }
  saveLocalStaffAccounts(accounts);

  // Sync to backend & Google Sheets
  try {
    fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SAVE_STAFF_USER',
        payload: updated,
        scriptUrl,
      }),
    }).catch(() => {});
  } catch {}

  return { success: true, message: `Account '${cleanId}' saved successfully.` };
}

/**
 * Deletes a staff account (Coordinator cannot be deleted).
 */
export async function deleteStaffAccount(
  staffId: string,
  scriptUrl?: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = staffId.trim().toLowerCase();
  if (cleanId === 'coordinator') {
    return { success: false, message: 'The primary Coordinator account cannot be deleted.' };
  }

  const accounts = getLocalStaffAccounts();
  const filtered = accounts.filter((u) => u.staffId.toLowerCase() !== cleanId);
  saveLocalStaffAccounts(filtered);

  try {
    fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE_STAFF_USER',
        staffId: cleanId,
        scriptUrl,
      }),
    }).catch(() => {});
  } catch {}

  return { success: true, message: `Account '${cleanId}' deleted.` };
}

/**
 * Asynchronously notifies Google Sheets of status/failedAttempts changes.
 */
function notifyRemoteStatusUpdate(
  staffId: string,
  status: string,
  failedAttempts: number,
  scriptUrl?: string
) {
  try {
    fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_STAFF_STATUS',
        staffId,
        status,
        failedAttempts,
        lastLogin: new Date().toISOString(),
        scriptUrl,
      }),
    }).catch(() => {});
  } catch {}
}
