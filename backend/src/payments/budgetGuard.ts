import { db } from '../db/supabase.js';

interface ActiveReservation {
  id: string;
  taskId: string;
  agentId: string;
  amount: number;
  timestamp: number;
}

class BudgetGuard {
  // In-memory atomic reservation lock for concurrent task execution steps
  private activeReservations: Map<string, ActiveReservation> = new Map();
  private maxCallsPerTask = 8;

  /**
   * Concurrency-safe atomic reservation of task budget.
   * Prevents race conditions where parallel agent calls could overspend the user's budget.
   */
  async reserveBudget(taskId: string, agentId: string, amountToSpend: number): Promise<{ success: boolean; remainingBudget: number; reservationId?: string; error?: string }> {
    const task = await db.getTaskById(taskId);
    if (!task) {
      return { success: false, remainingBudget: 0, error: 'Task not found' };
    }

    // Check maximum calls per task limit
    const existingSteps = await db.getTaskSteps(taskId);
    if (existingSteps.length >= this.maxCallsPerTask) {
      return {
        success: false,
        remainingBudget: task.budget_limit - task.total_cost,
        error: `Exceeded maximum allowed calls per task limit (${this.maxCallsPerTask})`,
      };
    }

    // Calculate sum of active reservations for this task
    let currentlyReserved = 0;
    for (const res of this.activeReservations.values()) {
      if (res.taskId === taskId) {
        currentlyReserved += res.amount;
      }
    }

    const availableBudget = task.budget_limit - (task.total_cost + currentlyReserved);
    const requiredAmount = Number(amountToSpend.toFixed(4));

    if (requiredAmount > availableBudget + 0.00001) {
      return {
        success: false,
        remainingBudget: Number(Math.max(0, availableBudget).toFixed(4)),
        error: `Insufficient task budget. Required: ${requiredAmount} USDC, Available: ${Number(availableBudget.toFixed(4))} USDC`,
      };
    }

    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeReservations.set(reservationId, {
      id: reservationId,
      taskId,
      agentId,
      amount: requiredAmount,
      timestamp: Date.now(),
    });

    const newRemaining = Number((availableBudget - requiredAmount).toFixed(4));
    return {
      success: true,
      remainingBudget: newRemaining,
      reservationId,
    };
  }

  /**
   * Commit reservation upon successful payment settlement.
   * Atomically updates task total_cost.
   */
  async commitReservation(reservationId: string): Promise<void> {
    const res = this.activeReservations.get(reservationId);
    if (!res) return;

    this.activeReservations.delete(reservationId);
    const task = await db.getTaskById(res.taskId);
    if (task) {
      const updatedTotal = Number((task.total_cost + res.amount).toFixed(4));
      await db.updateTask(task.id, { total_cost: updatedTotal });
    }
  }

  /**
   * Release reservation if a call failed before payment or if verification aborted.
   */
  releaseReservation(reservationId: string): void {
    this.activeReservations.delete(reservationId);
  }

  /**
   * Get current real-time remaining budget for a task taking into account committed costs and active locks.
   */
  async getRemainingBudget(taskId: string): Promise<number> {
    const task = await db.getTaskById(taskId);
    if (!task) return 0;

    let reserved = 0;
    for (const res of this.activeReservations.values()) {
      if (res.taskId === taskId) {
        reserved += res.amount;
      }
    }

    return Number(Math.max(0, task.budget_limit - (task.total_cost + reserved)).toFixed(4));
  }

  /**
   * Record measurable server-side model provider costs against task budget
   */
  async recordModelCost(taskId: string, modelCostUsd: number): Promise<void> {
    const task = await db.getTaskById(taskId);
    if (task && modelCostUsd > 0) {
      const updatedTotal = Number((task.total_cost + modelCostUsd).toFixed(4));
      await db.updateTask(task.id, { total_cost: updatedTotal });
    }
  }
}

export const budgetGuard = new BudgetGuard();
