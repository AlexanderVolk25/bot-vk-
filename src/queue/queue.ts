import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { getDb } from '../db';
import { appLogger } from '../logger';

export type TaskType = 'content' | 'moderation' | 'notification';

export type TaskStatus =
  | 'pending'
  | 'downloading'
  | 'processing'
  | 'uploading'
  | 'scheduled'
  | 'posted'
  | 'failed'
  | 'cancelled';

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  payload: Record<string, unknown>;
  progress: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export type TaskFilter = {
  type?: TaskType;
  status?: TaskStatus | TaskStatus[];
};

const MAX_QUEUE_SIZE = 10;

class TaskQueue extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private processingContent = false;

  constructor() {
    super();
    this.loadFromDb();
  }

  private loadFromDb(): void {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT * FROM queue_tasks WHERE status NOT IN ('posted', 'failed', 'cancelled')
        ORDER BY created_at ASC
      `).all() as Array<{
        id: string; type: string; status: string; payload: string;
        progress: number; created_at: number; updated_at: number; error: string | null;
      }>;

      for (const row of rows) {
        const task: Task = {
          id: row.id,
          type: row.type as TaskType,
          status: row.status as TaskStatus,
          payload: row.payload ? JSON.parse(row.payload) : {},
          progress: row.progress,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          error: row.error ?? undefined,
        };
        this.tasks.set(task.id, task);
      }

      appLogger.info(`Loaded ${this.tasks.size} tasks from DB`);
    } catch (err) {
      appLogger.error('Failed to load tasks from DB', { error: err });
    }
  }

  private persistTask(task: Task): void {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO queue_tasks (id, type, status, payload, progress, created_at, updated_at, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          payload = excluded.payload,
          progress = excluded.progress,
          updated_at = excluded.updated_at,
          error = excluded.error
      `).run(
        task.id,
        task.type,
        task.status,
        JSON.stringify(task.payload),
        task.progress,
        task.createdAt,
        task.updatedAt,
        task.error ?? null,
      );
    } catch (err) {
      appLogger.error('Failed to persist task', { taskId: task.id, error: err });
    }
  }

  addTask(type: TaskType, payload: Record<string, unknown>): Task {
    const activeTasks = Array.from(this.tasks.values()).filter(
      t => !['posted', 'failed', 'cancelled'].includes(t.status)
    );

    if (activeTasks.length >= MAX_QUEUE_SIZE) {
      throw new Error(`Queue is full (max ${MAX_QUEUE_SIZE} tasks)`);
    }

    const now = Math.floor(Date.now() / 1000);
    const task: Task = {
      id: randomUUID(),
      type,
      status: 'pending',
      payload,
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);
    this.persistTask(task);
    this.emit('taskAdded', task);
    appLogger.info(`Task added: ${task.id} (${type})`);

    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    if (['posted', 'failed', 'cancelled'].includes(task.status)) {
      return false;
    }

    task.status = 'cancelled';
    task.updatedAt = Math.floor(Date.now() / 1000);
    this.persistTask(task);
    this.emit('taskCancelled', task);
    appLogger.info(`Task cancelled: ${id}`);
    return true;
  }

  getTasks(filter?: TaskFilter): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(t => statuses.includes(t.status));
    }

    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  }

  updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'progress' | 'error' | 'payload'>>): void {
    const task = this.tasks.get(id);
    if (!task) {
      appLogger.warn(`Attempted to update non-existent task: ${id}`);
      return;
    }

    Object.assign(task, updates, { updatedAt: Math.floor(Date.now() / 1000) });
    this.persistTask(task);
    this.emit('taskUpdated', task);
  }

  getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      pending: 0,
      downloading: 0,
      processing: 0,
      uploading: 0,
      scheduled: 0,
      posted: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      stats[task.status] = (stats[task.status] || 0) + 1;
    }

    return stats;
  }

  isProcessingContent(): boolean {
    return this.processingContent;
  }

  setProcessingContent(value: boolean): void {
    this.processingContent = value;
  }

  getNextPendingContent(): Task | undefined {
    return Array.from(this.tasks.values()).find(
      t => t.type === 'content' && t.status === 'pending'
    );
  }
}

export const taskQueue = new TaskQueue();
export default taskQueue;
