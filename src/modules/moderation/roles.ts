import { getDb } from '../../db';
import { moderationLogger } from '../../logger';

export enum Role {
  Banned = 0,
  User = 1,
  Trusted = 2,
  Moderator = 3,
  Admin = 4,
  Owner = 5,
}

export const ROLE_NAMES: Record<Role, string> = {
  [Role.Banned]: 'Banned',
  [Role.User]: 'User',
  [Role.Trusted]: 'Trusted',
  [Role.Moderator]: 'Moderator',
  [Role.Admin]: 'Admin',
  [Role.Owner]: 'Owner',
};

export function getRoleName(role: Role): string {
  return ROLE_NAMES[role] || 'Unknown';
}

export function parseRole(name: string): Role | null {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(ROLE_NAMES)) {
    if (val.toLowerCase() === lower) return parseInt(key, 10) as Role;
  }
  return null;
}

export async function getUserRole(userId: number): Promise<Role> {
  try {
    const db = getDb();
    const row = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').get(userId) as { role: string } | undefined;
    if (!row) return Role.User;
    const roleVal = parseInt(row.role, 10);
    return isNaN(roleVal) ? Role.User : roleVal as Role;
  } catch (err) {
    moderationLogger.error('Error getting user role', { userId, error: err });
    return Role.User;
  }
}

export async function setUserRole(userId: number, role: Role, assignedBy: number): Promise<void> {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO user_roles (user_id, role, assigned_by, created_at)
      VALUES (?, ?, ?, strftime('%s','now'))
      ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, assigned_by = excluded.assigned_by
    `).run(userId, role, assignedBy);

    moderationLogger.info(`Role set: user=${userId}, role=${getRoleName(role)}, by=${assignedBy}`);
  } catch (err) {
    moderationLogger.error('Error setting user role', { userId, role, error: err });
    throw err;
  }
}

export function canPerformAction(actorRole: Role, targetRole: Role, action: string): boolean {
  if (actorRole === Role.Owner) return true;
  if (actorRole <= targetRole) return false;

  switch (action) {
    case 'warn':
    case 'mute':
    case 'kick':
      return actorRole >= Role.Moderator && targetRole < actorRole;
    case 'ban':
    case 'unban':
      return actorRole >= Role.Admin && targetRole < actorRole;
    case 'setRole':
      return actorRole >= Role.Admin && targetRole < actorRole;
    default:
      return actorRole > targetRole;
  }
}

export async function isUserBanned(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === Role.Banned;
}
