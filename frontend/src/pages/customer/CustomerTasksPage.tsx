import React, { useState, useEffect } from 'react';
import { api, Task } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  ListTodo,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Coins,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';

interface CustomerTasksPageProps {
  onNavigate: (tab: string) => void;
  onSelectTask: (taskId: string) => void;
}

export const CustomerTasksPage: React.FC<CustomerTasksPageProps> = ({ onNavigate, onSelectTask }) => {
  const { user } = useAuth();
  const { playClick } = useSound();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.getTasks(user?.id);
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  const filteredTasks = tasks.filter((t) => {
    const matchesFilter = filterStatus === 'all' || t.status === filterStatus;
    const matchesSearch =
      !search ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">My Autonomous Tasks</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review past executions, live task states, itemized payments, and output schemas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
          </button>
          <button
            onClick={() => {
              playClick();
              onNavigate('create_task');
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-glow-accent transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'in_progress', 'completed', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => {
                playClick();
                setFilterStatus(st);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase font-mono transition-colors shrink-0 ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Task List Table */}
      <div className="p-6 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <ListTodo className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No tasks found matching your filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => {
                  playClick();
                  onSelectTask(task.id);
                  if (task.status === 'completed' || task.status === 'failed') {
                    onNavigate('results');
                  } else {
                    onNavigate('live_execution');
                  }
                }}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs truncate max-w-lg group-hover:text-indigo-300 transition-colors">
                      {task.description}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                        task.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : task.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3">
                    <span>Started: {new Date(task.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>Budget Cap: {task.budget_limit.toFixed(2)} USDC</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {task.total_cost.toFixed(2)} USDC
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Actual Spent</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
