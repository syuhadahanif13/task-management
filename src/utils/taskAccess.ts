import { Task } from '../types';

export interface UserContext {
  username: string;
  role?: 'admin' | 'user' | string;
  divisionId?: string;
}

/**
 * Checks if a task is assigned to a specific user (either as single assignee or in multi-assignees array).
 * If the user is an admin, always returns true.
 */
export const isTaskAssignedToUser = (
  task: Task,
  user?: UserContext | null
): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const target = user.username.trim().toLowerCase();

  // Check multi-assignees array
  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    if (task.assignees.some((a) => a.trim().toLowerCase() === target)) {
      return true;
    }
  }

  // Check comma-separated or single assignee string
  if (task.assignee) {
    const parts = task.assignee.split(',').map((s) => s.trim().toLowerCase());
    if (parts.includes(target)) {
      return true;
    }
  }

  return false;
};

/**
 * Filters an array of tasks based on user role and assignment.
 * Admins get all tasks; regular users only get tasks assigned to them.
 */
export const filterTasksForUser = <T extends Task>(
  tasks: T[],
  user?: UserContext | null
): T[] => {
  if (!user || user.role === 'admin') return tasks;
  return tasks.filter((t) => isTaskAssignedToUser(t, user));
};
