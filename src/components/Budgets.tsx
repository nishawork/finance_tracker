import { useState, useEffect } from 'react';
import { Plus, Target, TrendingUp, AlertCircle, X, TrendingDown, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Budget {
  id: string;
  name: string;
  amount: number;
  period: string;
  spent: number;
  percentage: number;
  category_name: string | null;
  start_date: string;
  end_date: string | null;
}

export function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadBudgets();
  }, [user]);

  const loadBudgets = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('budgets')
      .select(`
        id,
        name,
        amount,
        period,
        start_date,
        end_date,
        category_id,
        categories(name)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading budgets:', error);
      setLoading(false);
      return;
    }

    const budgetsWithSpending = await Promise.all(
      (data || []).map(async (budget: any) => {
        const startDate = new Date(budget.start_date);
        const endDate = budget.end_date ? new Date(budget.end_date) : getEndDateForPeriod(startDate, budget.period);

        let query = supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('transaction_date', budget.start_date)
          .lte('transaction_date', endDate.toISOString().split('T')[0]);

        if (budget.category_id) {
          query = query.eq('category_id', budget.category_id);
        }

        const { data: transactions } = await query;

        const spent = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const percentage = (spent / Number(budget.amount)) * 100;

        return {
          id: budget.id,
          name: budget.name,
          amount: Number(budget.amount),
          period: budget.period,
          spent,
          percentage,
          category_name: budget.categories?.name || null,
          start_date: budget.start_date,
          end_date: budget.end_date,
        };
      })
    );

    setBudgets(budgetsWithSpending);
    setLoading(false);
  };

  const getEndDateForPeriod = (startDate: Date, period: string): Date => {
    const date = new Date(startDate);
    switch (period) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <AlertCircle className="text-red-500" size={20} />;
    if (percentage >= 80) return <AlertCircle className="text-amber-500" size={20} />;
    return <TrendingUp className="text-emerald-500" size={20} />;
  };

  const CircularProgressRing = ({ percentage, size = 120 }: { percentage: number; size?: number }) => {
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={percentage >= 100 ? '#ef4444' : percentage >= 80 ? '#f59e0b' : '#10b981'}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
    );
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
          <h2 className="text-3xl font-bold text-gray-900">Budgets</h2>
          <p className="text-gray-600 mt-1">Track your spending against budgets</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Budget</span>
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-gray-400 mb-4">
            <Target size={48} className="mx-auto" />
          </div>
          <p className="text-gray-600 mb-4">No budgets yet. Create your first budget to track spending!</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition"
          >
            Create Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => (
            <div key={budget.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-base">{budget.name}</h3>
                    {budget.category_name && (
                      <p className="text-xs text-gray-500 mt-1">{budget.category_name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 capitalize">{budget.period}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative">
                    <CircularProgressRing percentage={Math.min(budget.percentage, 100)} size={100} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-sm font-bold ${
                        budget.percentage >= 100 ? 'text-red-600' :
                        budget.percentage >= 80 ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {budget.percentage.toFixed(0)}%
                      </span>
                      <span className="text-xs text-gray-500">of limit</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Spent</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(budget.spent)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Limit</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-600">Remaining</span>
                    <span className={`font-semibold ${
                      budget.amount - budget.spent >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(Math.max(0, budget.amount - budget.spent))}
                    </span>
                  </div>
                </div>

                {budget.percentage >= 80 && (
                  <div className={`text-xs p-2 rounded-lg text-center ${
                    budget.percentage >= 100
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {budget.percentage >= 100
                      ? 'Budget exceeded'
                      : 'Approaching limit'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <AddBudgetModal onClose={() => setShowAddModal(false)} onSuccess={loadBudgets} />}
    </div>
  );
}

interface AddBudgetModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddBudgetModal({ onClose, onSuccess }: AddBudgetModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [user]);

  const loadCategories = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .eq('type', 'expense')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .order('name');
    if (data) setCategories(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const startDate = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from('budgets').insert({
        user_id: user.id,
        name,
        amount: parseFloat(amount),
        period,
        category_id: categoryId || null,
        start_date: startDate,
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding budget:', error);
      alert('Failed to add budget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create Budget</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Budget Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="e.g., Monthly Food Budget"
              required
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Budget Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">₹</span>
              <input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-2">
              Period
            </label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category (Optional)
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
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
              {loading ? 'Creating...' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
