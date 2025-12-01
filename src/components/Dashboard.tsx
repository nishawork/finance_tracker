import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight, AlertCircle, Repeat, Eye, BarChart3, Target, Zap, TrendingUpIcon, Calendar, Clock, Heart, Lightbulb, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SpendingTrendChart, NetCashFlowChart, CategoryBreakdownChart, SpendingPatternChart, ExpenseVsIncomeLineChart } from './charts/SpendingChart';
import { aiFinancialAdvice } from '../services/aiFinancialAdvice';
import { DashboardSkeleton } from './utils/LoadingSkeletons';

interface DashboardStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number;
  financialHealthScore: number;
  topSpendingCategory: string;
  spendingTrend: 'up' | 'down' | 'stable';
}

interface RecentTransaction {
  id: string;
  amount: number;
  type: string;
  merchant: string | null;
  category_name: string;
  transaction_date: string;
  account_name: string;
}

interface UpcomingSubscription {
  id: string;
  name: string;
  amount: number;
  next_billing_date: string;
}

interface BudgetAlert {
  id: string;
  name: string;
  spent: number;
  limit: number;
  percentage: number;
}

interface MonthlyTrendData {
  month: string;
  income: number;
  expense: number;
}

interface CategorySpending {
  name: string;
  value: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    savingsRate: 0,
    financialHealthScore: 0,
    topSpendingCategory: '',
    spendingTrend: 'stable',
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [upcomingSubscriptions, setUpcomingSubscriptions] = useState<UpcomingSubscription[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendData[]>([]);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const calculateFinancialHealthScore = (income: number, expense: number, savingsRate: number, balance: number): number => {
    let score = 0;

    // Savings rate component (0-30 points)
    if (savingsRate >= 30) score += 30;
    else if (savingsRate >= 20) score += 25;
    else if (savingsRate >= 10) score += 20;
    else if (savingsRate >= 5) score += 15;
    else score += 5;

    // Expense to income ratio (0-30 points)
    const expenseRatio = income > 0 ? (expense / income) * 100 : 100;
    if (expenseRatio <= 60) score += 30;
    else if (expenseRatio <= 70) score += 25;
    else if (expenseRatio <= 80) score += 20;
    else if (expenseRatio <= 90) score += 10;

    // Balance health (0-40 points)
    const monthlyBalance = income - expense;
    if (balance > income * 2) score += 40;
    else if (balance > income) score += 35;
    else if (balance > monthlyBalance * 3) score += 30;
    else if (balance > 0) score += 20;
    else score += 5;

    return Math.round(Math.min(100, score));
  };

  const loadDashboardData = async () => {
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

    const [accountsRes, transactionsRes, recentRes, subscriptionsRes, budgetsRes, allTransactionsRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('balance')
        .eq('user_id', user.id)
        .eq('is_active', true),

      supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user.id)
        .gte('transaction_date', startOfMonth),

      supabase
        .from('transactions')
        .select(`
          id,
          amount,
          type,
          merchant,
          transaction_date,
          categories(name),
          accounts(name)
        `)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(5),

      supabase
        .from('subscriptions')
        .select('id, name, amount, next_billing_date')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('next_billing_date', { ascending: true })
        .limit(3),

      supabase
        .from('budgets')
        .select('id, name, amount, category_id, categories(name)')
        .eq('user_id', user.id)
        .eq('is_active', true),

      supabase
        .from('transactions')
        .select('amount, type, transaction_date, categories(name)')
        .eq('user_id', user.id)
        .gte('transaction_date', sixMonthsAgo)
    ]);

    if (accountsRes.data) {
      const totalBalance = accountsRes.data.reduce((sum, acc) => sum + Number(acc.balance), 0);
      setStats(prev => ({ ...prev, totalBalance }));
    }

    if (transactionsRes.data && accountsRes.data) {
      const income = transactionsRes.data
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expense = transactionsRes.data
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
      const totalBalance = accountsRes.data.reduce((sum, acc) => sum + Number(acc.balance), 0);

      const healthScore = calculateFinancialHealthScore(income, expense, savingsRate, totalBalance);

      setStats(prev => ({
        ...prev,
        monthlyIncome: income,
        monthlyExpense: expense,
        savingsRate: Math.max(0, savingsRate),
        financialHealthScore: healthScore,
      }));
    }

    if (recentRes.data) {
      const formatted = recentRes.data.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        merchant: t.merchant,
        category_name: t.categories?.name || 'Uncategorized',
        transaction_date: t.transaction_date,
        account_name: t.accounts?.name || 'Unknown',
      }));
      setRecentTransactions(formatted);
    }

    if (subscriptionsRes.data) {
      setUpcomingSubscriptions(subscriptionsRes.data);
    }

    if (budgetsRes.data) {
      const alerts: BudgetAlert[] = [];
      for (const budget of budgetsRes.data) {
        const { data: transactions } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('transaction_date', startOfMonth);

        let spent = 0;
        if (transactions) {
          if (budget.category_id) {
            spent = transactions
              .filter(t => t.category_id === budget.category_id)
              .reduce((sum, t) => sum + Number(t.amount), 0);
          } else {
            spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
          }
        }

        const percentage = (spent / Number(budget.amount)) * 100;
        if (percentage >= 80) {
          alerts.push({
            id: budget.id,
            name: budget.name,
            spent,
            limit: Number(budget.amount),
            percentage,
          });
        }
      }
      setBudgetAlerts(alerts);
    }

    if (allTransactionsRes.data) {
      const monthlyData: Record<string, { income: number; expense: number }> = {};

      allTransactionsRes.data.forEach((t: any) => {
        const date = new Date(t.transaction_date);
        const monthKey = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { income: 0, expense: 0 };
        }

        if (t.type === 'income') {
          monthlyData[monthKey].income += Number(t.amount);
        } else {
          monthlyData[monthKey].expense += Number(t.amount);
        }
      });

      const trendArray = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      setMonthlyTrend(trendArray);

      const categorySpendingMap: Record<string, number> = {};
      allTransactionsRes.data.forEach((t: any) => {
        if (t.type === 'expense') {
          const catName = t.categories?.name || 'Other';
          categorySpendingMap[catName] = (categorySpendingMap[catName] || 0) + Number(t.amount);
        }
      });

      const topCategories = Object.entries(categorySpendingMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      setCategorySpending(topCategories);

      // Calculate spending trend
      if (trendArray.length >= 2) {
        const recentExpense = trendArray[trendArray.length - 1]?.expense || 0;
        const previousExpense = trendArray[trendArray.length - 2]?.expense || 0;
        const trend = recentExpense > previousExpense * 1.1 ? 'up' : recentExpense < previousExpense * 0.9 ? 'down' : 'stable';

        // Get top spending category
        const topCategory = topCategories.length > 0 ? topCategories[0].name : '';

        setStats(prev => ({
          ...prev,
          spendingTrend: trend,
          topSpendingCategory: topCategory,
        }));
      }

      // Generate AI insights
      generateAiInsights(transactionsRes.data, categorySpendingMap, stats.monthlyIncome, stats.monthlyExpense);
    }

    setLoading(false);
  };

  const generateAiInsights = async (transactions: any[], categoryMap: Record<string, number>, income: number, expense: number) => {
    const insights: string[] = [];

    const expenseRatio = income > 0 ? (expense / income) * 100 : 0;

    if (expenseRatio > 80) {
      insights.push('Your spending is high relative to income. Try to reduce expenses or increase income.');
    }

    const topCategory = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)[0];
    if (topCategory) {
      const categoryPercentage = (topCategory[1] / expense) * 100;
      if (categoryPercentage > 40) {
        insights.push(`${topCategory[0]} is your largest expense category at ${categoryPercentage.toFixed(0)}%. Consider optimizing here.`);
      }
    }

    if (income > 0 && (income - expense) / income >= 0.3) {
      insights.push('Excellent! You\'re saving over 30% of your income. Keep up this great habit!');
    }

    if (insights.length === 0) {
      insights.push('Your finances look good! Keep tracking your expenses regularly.');
    }

    setAiInsights(insights.slice(0, 3));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Welcome back! Here's your financial overview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Wallet className="text-blue-600" size={24} />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalBalance)}</div>
          <div className="text-sm text-gray-600 mt-1">Total Balance</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-emerald-600" size={24} />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.monthlyIncome)}</div>
          <div className="text-sm text-gray-600 mt-1">This Month Income</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.monthlyExpense)}</div>
          <div className="text-sm text-gray-600 mt-1">This Month Expense</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <PiggyBank className="text-amber-600" size={24} />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.savingsRate.toFixed(1)}%</div>
          <div className="text-sm text-gray-600 mt-1">Savings Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Monthly Trend</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Income Growth</span>
              <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                <TrendingUp size={16} /> {monthlyTrend.length >= 2 ? ((monthlyTrend[monthlyTrend.length - 1].income - monthlyTrend[monthlyTrend.length - 2].income) / monthlyTrend[monthlyTrend.length - 2].income * 100).toFixed(1) : '0'}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Expense Change</span>
              <span className="text-sm font-semibold text-red-600 flex items-center gap-1">
                <TrendingDown size={16} /> {monthlyTrend.length >= 2 ? ((monthlyTrend[monthlyTrend.length - 1].expense - monthlyTrend[monthlyTrend.length - 2].expense) / monthlyTrend[monthlyTrend.length - 2].expense * 100).toFixed(1) : '0'}%
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Cash Flow</span>
              <span className="text-sm font-semibold text-blue-600">↑ {formatCurrency(stats.monthlyIncome - stats.monthlyExpense)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
            <Heart size={16} className="text-red-500" />
            Financial Health
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Overall Score</span>
                <span className={`font-semibold text-lg ${stats.financialHealthScore >= 75 ? 'text-emerald-600' : stats.financialHealthScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {stats.financialHealthScore}/100
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${stats.financialHealthScore >= 75 ? 'bg-gradient-to-r from-emerald-500 to-blue-500' : stats.financialHealthScore >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                  style={{ width: `${stats.financialHealthScore}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-600 pt-2 border-t border-gray-100">
              {stats.savingsRate >= 20 && 'Your savings rate is strong. Keep it up!'}
              {stats.savingsRate < 20 && stats.savingsRate >= 10 && 'Good progress! Aim for higher savings.'}
              {stats.savingsRate < 10 && 'Focus on increasing your savings rate.'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-600 mb-3">This vs Last Month</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Income</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(stats.monthlyIncome)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Expenses</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(stats.monthlyExpense)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-600">Net</span>
              <span className="text-sm font-semibold text-emerald-600">{formatCurrency(stats.monthlyIncome - stats.monthlyExpense)}</span>
            </div>
          </div>
        </div>
      </div>

      {monthlyTrend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SpendingTrendChart data={monthlyTrend} />
          <NetCashFlowChart data={monthlyTrend} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdownChart categoryData={categorySpending} />

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Target size={20} className="text-blue-600" />
              Top Categories
            </h3>
          </div>
          {categorySpending.length > 0 ? (
            <div className="space-y-3">
              {categorySpending.map((category, index) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-gray-700">{category.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{formatCurrency(category.value)}</span>
                    <div className="text-xs text-gray-500">{((category.value / stats.monthlyExpense) * 100).toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No expense data available
            </div>
          )}
        </div>
      </div>

      {budgetAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 mb-2">Budget Alerts</h4>
              <div className="space-y-2">
                {budgetAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-800">{alert.name}</span>
                    <span className="font-semibold text-amber-700">{alert.percentage.toFixed(0)}% used</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transactions yet. Add your first transaction!</p>
            ) : (
              recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      transaction.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="text-emerald-600" size={20} />
                      ) : (
                        <ArrowDownRight className="text-red-600" size={20} />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {transaction.merchant || transaction.category_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.account_name} • {formatDate(transaction.transaction_date)}
                      </div>
                    </div>
                  </div>
                  <div className={`font-semibold ${
                    transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl p-6 shadow-lg text-white">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Lightbulb size={20} />
            AI Insights
          </h3>
          <div className="space-y-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold mb-1">{formatCurrency(stats.monthlyIncome - stats.monthlyExpense)}</div>
              <div className="text-sm opacity-90">Net Cash Flow This Month</div>
            </div>

            {aiInsights.map((insight, idx) => (
              <div key={idx} className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-sm opacity-90 leading-relaxed">{insight}</div>
              </div>
            ))}

            {stats.monthlyExpense > stats.monthlyIncome && (
              <div className="bg-red-500 bg-opacity-30 rounded-lg p-4 backdrop-blur-sm border border-red-300">
                <div className="font-semibold mb-1">Spending Alert</div>
                <div className="text-sm opacity-90">
                  You've spent more than you earned this month. Consider reviewing your expenses.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {upcomingSubscriptions.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Repeat size={20} />
            Upcoming Subscriptions
          </h3>
          <div className="space-y-3">
            {upcomingSubscriptions.map((sub) => {
              const daysUntil = Math.ceil((new Date(sub.next_billing_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={sub.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition border border-gray-100">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{sub.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Due in {daysUntil} days
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCurrency(sub.amount)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
