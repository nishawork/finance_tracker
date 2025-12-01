import { useState, useEffect } from 'react';
import { Plus, Target, X, AlertCircle, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Goal {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  icon: string;
  color: string;
  percentage: number;
}

export function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadGoals();
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading goals:', error);
      setLoading(false);
      return;
    }

    if (data) {
      const goalsWithPercentage = data.map((goal) => ({
        ...goal,
        percentage: (Number(goal.current_amount) / Number(goal.target_amount)) * 100,
      }));
      setGoals(goalsWithPercentage);
    }

    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No deadline';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (dateString: string | null) => {
    if (!dateString) return null;
    const target = new Date(dateString);
    const today = new Date();
    const diff = target.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const getMonthlyNeeded = (goal: Goal) => {
    if (!goal.target_date) return null;
    const daysLeft = getDaysRemaining(goal.target_date);
    if (!daysLeft || daysLeft <= 0) return null;
    const monthsLeft = daysLeft / 30;
    const needed = (goal.target_amount - goal.current_amount) / monthsLeft;
    return needed;
  };

  const getGoalStatus = (goal: Goal) => {
    if (goal.percentage >= 100) return 'completed';
    const daysRemaining = getDaysRemaining(goal.target_date);
    if (daysRemaining !== null && daysRemaining < 0) return 'overdue';
    return 'active';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Savings Goals</h2>
          <p className="text-gray-600 mt-1">Track progress towards your financial goals</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Goal</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-gray-400 mb-4">
            <Target size={48} className="mx-auto" />
          </div>
          <p className="text-gray-600 mb-4">No goals yet. Create your first savings goal!</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition"
          >
            Create Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const daysRemaining = getDaysRemaining(goal.target_date);
            const monthlyNeeded = getMonthlyNeeded(goal);
            const status = getGoalStatus(goal);
            return (
              <div
                key={goal.id}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: goal.color + '20' }}
                    >
                      {goal.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 text-lg">{goal.name}</h3>
                        {status === 'completed' && <CheckCircle2 className="text-emerald-600" size={18} />}
                        {status === 'overdue' && <AlertCircle className="text-red-600" size={18} />}
                      </div>
                      {goal.description && (
                        <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">
                        {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
                      </span>
                      <span className="font-semibold text-emerald-600">
                        {goal.percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${Math.min(goal.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <div className="text-xs text-gray-500">Remaining</div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {formatCurrency(Math.max(0, goal.target_amount - goal.current_amount))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Target Date</div>
                      <div className="font-medium text-gray-900 text-sm">
                        {formatDate(goal.target_date)}
                      </div>
                    </div>
                  </div>

                  {monthlyNeeded && monthlyNeeded > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                      <TrendingUp size={16} className="text-blue-600 flex-shrink-0" />
                      <div className="text-xs text-blue-700">
                        Save <span className="font-semibold">{formatCurrency(monthlyNeeded)}</span>/month
                      </div>
                    </div>
                  )}

                  {daysRemaining !== null && (
                    <div className={`text-xs p-2 rounded-lg text-center font-medium ${
                      daysRemaining < 30 && daysRemaining > 0
                        ? 'bg-amber-50 text-amber-700'
                        : daysRemaining <= 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {daysRemaining > 0 ? `${daysRemaining} days left` : daysRemaining === 0 ? 'Due today' : 'Overdue'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && <AddGoalModal onClose={() => setShowAddModal(false)} onSuccess={loadGoals} />}
    </div>
  );
}

interface AddGoalModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddGoalModal({ onClose, onSuccess }: AddGoalModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(false);

  const goalIcons = ['🎯', '🏠', '🚗', '✈️', '💍', '🎓', '💰', '📱'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const { error } = await supabase.from('goals').insert({
        user_id: user.id,
        name,
        description: description || null,
        target_amount: parseFloat(targetAmount),
        target_date: targetDate || null,
        icon: goalIcons[Math.floor(Math.random() * goalIcons.length)],
        color: '#f59e0b',
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Failed to add goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create Savings Goal</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Goal Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="e.g., New Phone, Vacation, Emergency Fund"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Add details about your goal..."
            />
          </div>

          <div>
            <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Target Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">₹</span>
              <input
                id="targetAmount"
                type="number"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="targetDate" className="block text-sm font-medium text-gray-700 mb-2">
              Target Date (Optional)
            </label>
            <input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
