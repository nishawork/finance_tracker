import { useState, useEffect } from 'react';
import { Download, TrendingUp, AlertCircle, Lightbulb, Zap, FileDown, Share2, Calendar, PieChart, BarChart3, LineChart, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateFinancialReport, calculateFinancialScore, predictFutureSpending } from '../services/aiReportGenerator';
import { SpendingTrendChart, CategoryBreakdownChart, SpendingPatternChart, ExpenseVsIncomeLineChart } from './charts/SpendingChart';

interface CategoryData {
  name: string;
  value: number;
  icon: string;
}

interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
}

export function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [savingsRate, setSavingsRate] = useState(0);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [financialScore, setFinancialScore] = useState(0);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [predictedMonth, setPredictedMonth] = useState<{ income: number; expense: number; savings: number }>({
    income: 0,
    expense: 0,
    savings: 0,
  });
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [reportPeriod, setReportPeriod] = useState<'month' | 'quarter' | '6months' | 'year'>('month');

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

  useEffect(() => {
    loadReportsData();
  }, [user, dateRange, reportPeriod]);

  const handlePeriodChange = (period: 'month' | 'quarter' | '6months' | 'year') => {
    setReportPeriod(period);
    const now = new Date();
    let from = new Date();

    switch (period) {
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        from = new Date(now.getFullYear(), Math.max(0, now.getMonth() - 2), 1);
        break;
      case '6months':
        from = new Date(now.getFullYear(), Math.max(0, now.getMonth() - 5), 1);
        break;
      case 'year':
        from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
    }

    setDateRange({
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    });
  };

  const loadReportsData = async () => {
    if (!user) return;

    const [transactionsRes, categoriesRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, type, transaction_date, category_id, categories(name, icon)')
        .eq('user_id', user.id)
        .gte('transaction_date', dateRange.from)
        .lte('transaction_date', dateRange.to),

      supabase
        .from('categories')
        .select('id, name, icon')
        .eq('type', 'expense')
        .or(`user_id.eq.${user.id},is_system.eq.true`),
    ]);

    if (transactionsRes.data) {
      const txns = transactionsRes.data;

      const income = txns
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expense = txns
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const rate = income > 0 ? ((income - expense) / income) * 100 : 0;

      setTotalIncome(income);
      setTotalExpense(expense);
      setSavingsRate(Math.max(0, rate));

      const categorySpending: Record<string, { amount: number; icon: string }> = {};

      txns.forEach(t => {
        if (t.type === 'expense' && t.categories) {
          const catId = t.category_id;
          if (!categorySpending[catId]) {
            categorySpending[catId] = { amount: 0, icon: t.categories.icon };
          }
          categorySpending[catId].amount += Number(t.amount);
        }
      });

      const categoryArray = Object.entries(categorySpending).map(([catId, data]) => {
        const category = categoriesRes.data?.find(c => c.id === catId);
        return {
          name: category?.name || 'Other',
          value: data.amount,
          icon: data.icon,
        };
      }).sort((a, b) => b.value - a.value).slice(0, 8);

      setCategoryData(categoryArray);

      const monthlyData: Record<string, { income: number; expense: number }> = {};

      txns.forEach(t => {
        const date = new Date(t.transaction_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { income: 0, expense: 0 };
        }

        if (t.type === 'income') {
          monthlyData[monthKey].income += Number(t.amount);
        } else {
          monthlyData[monthKey].expense += Number(t.amount);
        }
      });

      const sortedMonths = Object.keys(monthlyData).sort();
      const trend = sortedMonths.map(month => ({
        month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        income: monthlyData[month].income,
        expense: monthlyData[month].expense,
      }));

      setMonthlyTrend(trend);

      const currentMonth = {
        income,
        expense,
        savings: income - expense,
        savingsRate: Math.max(0, savingsRate),
      };

      const previousMonth = trend.length > 1
        ? {
            income: monthlyData[monthlyData.length - 2].income,
            expense: monthlyData[monthlyData.length - 2].expense,
            savings:
              monthlyData[monthlyData.length - 2].income -
              monthlyData[monthlyData.length - 2].expense,
            savingsRate:
              monthlyData.length > 1
                ? ((monthlyData[monthlyData.length - 2].income -
                    monthlyData[monthlyData.length - 2].expense) /
                    monthlyData[monthlyData.length - 2].income) *
                  100
                : 0,
          }
        : currentMonth;

      const report = generateFinancialReport(currentMonth, previousMonth, categorySpending, expense);

      setAiInsights(report.summary);
      setRecommendations(report.recommendations);
      setRiskFactors(report.riskFactors);

      const expenseVariance = trend.length > 1
        ? (expense - monthlyData[monthlyData.length - 2].expense) / monthlyData[monthlyData.length - 2].expense
        : 0;

      const score = calculateFinancialScore(currentMonth, expenseVariance);
      setFinancialScore(score);

      const predicted = predictFutureSpending(
        sortedMonths.map((month) => ({
          income: monthlyData[month].income,
          expense: monthlyData[month].expense,
          savings: monthlyData[month].income - monthlyData[month].expense,
          savingsRate:
            (monthlyData[month].income - monthlyData[month].expense) /
            monthlyData[month].income *
            100,
        }))
      );
      setPredictedMonth(predicted);
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
          <h2 className="text-3xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-600 mt-1">Comprehensive financial insights and trends</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition">
          <Download size={20} />
          Export PDF
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePeriodChange('month')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportPeriod === 'month'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handlePeriodChange('quarter')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportPeriod === 'quarter'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 3 Months
            </button>
            <button
              onClick={() => handlePeriodChange('6months')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportPeriod === '6months'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 6 Months
            </button>
            <button
              onClick={() => handlePeriodChange('year')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportPeriod === 'year'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last Year
            </button>
          </div>
          <div className="flex gap-3 items-center">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-gray-600">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Total Income</div>
          <div className="text-3xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Total Expense</div>
          <div className="text-3xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Net Savings</div>
          <div className="text-3xl font-bold text-blue-600">{formatCurrency(totalIncome - totalExpense)}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Savings Rate</div>
          <div className="text-3xl font-bold text-amber-600">{savingsRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdownChart categoryData={categoryData} />

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
          <div className="space-y-3">
            {categoryData.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{cat.name}</div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                        style={{ width: `${(cat.value / totalExpense) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(cat.value)}</div>
                  <div className="text-xs text-gray-500">{((cat.value / totalExpense) * 100).toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingTrendChart data={monthlyTrend} />
        <ExpenseVsIncomeLineChart data={monthlyTrend} />
      </div>

      <SpendingPatternChart data={monthlyTrend} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Financial Score</div>
          <div className="flex items-end gap-2">
            <div className="text-4xl font-bold text-emerald-600">{financialScore}</div>
            <div className="text-sm text-gray-500 mb-1">/100</div>
          </div>
          <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-blue-500 h-full transition-all"
              style={{ width: `${financialScore}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Predicted Next Month</div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-500">Income</div>
              <div className="text-lg font-semibold text-emerald-600">₹{formatCurrency(predictedMonth.income).replace('₹', '')}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Expense</div>
              <div className="text-lg font-semibold text-red-600">₹{formatCurrency(predictedMonth.expense).replace('₹', '')}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Projected Savings</div>
          <div className="text-3xl font-bold text-blue-600">₹{formatCurrency(predictedMonth.savings).replace('₹', '')}</div>
          <div className="mt-2 text-xs text-gray-500">Based on historical trends</div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="text-blue-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Financial Summary</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{aiInsights}</p>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lightbulb className="text-emerald-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Personalized Recommendations</h3>
              <ul className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {riskFactors.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border border-red-200">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="text-red-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Areas of Concern</h3>
              <ul className="space-y-2">
                {riskFactors.map((risk, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-red-600 font-bold">⚠</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
