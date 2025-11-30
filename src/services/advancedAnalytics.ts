import { supabase } from '../lib/supabase';

export interface AnomalyAlert {
  type: 'sudden_spike' | 'unusual_category' | 'duplicate' | 'pattern_break';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  amount?: number;
  date: string;
}

export interface CategoryPattern {
  category: string;
  avgAmount: number;
  stdDeviation: number;
  monthlyTrend: number[];
  confidence: number;
}

export interface CashFlowForecast {
  month: string;
  predictedIncome: number;
  predictedExpense: number;
  predictedSavings: number;
  confidence: number;
}

export async function detectAnomalies(userId: string): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, amount, type, merchant, transaction_date, category_id, created_at, categories(name)')
      .eq('user_id', userId)
      .gte('transaction_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false });

    if (!transactions || transactions.length === 0) {
      return alerts;
    }

    const recentTransactions = transactions.slice(0, 10);

    for (const txn of recentTransactions) {
      if (txn.type !== 'expense') continue;

      const similar = transactions.filter(
        t =>
          t.category_id === txn.category_id &&
          t.type === 'expense' &&
          t.id !== txn.id &&
          Math.abs(Number(t.amount) - Number(txn.amount)) < Number(txn.amount) * 0.2
      );

      if (similar.length === 0) continue;

      const amounts = [Number(txn.amount), ...similar.map(s => Number(s.amount))];
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - avgAmount, 2), 0) / amounts.length);

      if (Number(txn.amount) > avgAmount + 2 * stdDev) {
        alerts.push({
          type: 'sudden_spike',
          severity: 'high',
          title: `Unusual spike in ${(txn.categories as any)?.name || 'category'} spending`,
          description: `You spent ₹${Number(txn.amount).toLocaleString('en-IN')} on ${txn.merchant}, which is significantly higher than your average of ₹${avgAmount.toLocaleString('en-IN')}`,
          amount: Number(txn.amount),
          date: txn.transaction_date,
        });
      }
    }

    const duplicates = findDuplicateTransactions(transactions);
    for (const dup of duplicates) {
      alerts.push({
        type: 'duplicate',
        severity: 'medium',
        title: 'Possible duplicate transaction detected',
        description: `Found similar transactions: ${dup.merchants.join(' and ')} with amounts ₹${dup.amount.toLocaleString('en-IN')}`,
        amount: dup.amount,
        date: dup.date,
      });
    }

    return alerts;
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return alerts;
  }
}

function findDuplicateTransactions(
  transactions: any[]
): Array<{ merchants: string[]; amount: number; date: string }> {
  const duplicates: Array<{ merchants: string[]; amount: number; date: string }> = [];
  const checked = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const t1 = transactions[i];
      const t2 = transactions[j];

      const key = `${t1.id}-${t2.id}`;
      if (checked.has(key)) continue;

      const timeDiff = Math.abs(
        new Date(t1.created_at).getTime() - new Date(t2.created_at).getTime()
      ) / (1000 * 60);

      if (
        t1.amount === t2.amount &&
        t1.type === t2.type &&
        timeDiff < 60 &&
        timeDiff > 0
      ) {
        duplicates.push({
          merchants: [t1.merchant || 'Unknown', t2.merchant || 'Unknown'],
          amount: Number(t1.amount),
          date: t1.transaction_date,
        });
        checked.add(key);
      }
    }
  }

  return duplicates;
}

export async function analyzeCategoryPatterns(userId: string): Promise<CategoryPattern[]> {
  const patterns: CategoryPattern[] = [];

  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type, transaction_date, category_id, categories(name)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false });

    if (!transactions || transactions.length === 0) {
      return patterns;
    }

    const categoryData: Record<string, number[]> = {};

    for (const txn of transactions) {
      const category = (txn.categories as any)?.name || 'Uncategorized';
      if (!categoryData[category]) {
        categoryData[category] = [];
      }
      categoryData[category].push(Number(txn.amount));
    }

    for (const [category, amounts] of Object.entries(categoryData)) {
      if (amounts.length < 2) continue;

      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((sq, n) => sq + Math.pow(n - avgAmount, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      const monthlyTrend: number[] = [];
      for (let i = 0; i < 6; i++) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);

        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);

        const monthAmount = amounts.filter(a => {
          const txnMonth = transactions.find(t => Number(t.amount) === a);
          return txnMonth && new Date(txnMonth.transaction_date) >= monthStart && new Date(txnMonth.transaction_date) <= monthEnd;
        });

        monthlyTrend.unshift(monthAmount.reduce((a, b) => a + b, 0));
      }

      patterns.push({
        category,
        avgAmount,
        stdDeviation: stdDev,
        monthlyTrend,
        confidence: Math.min(amounts.length / 10, 1),
      });
    }

    return patterns.sort((a, b) => b.avgAmount - a.avgAmount);
  } catch (error) {
    console.error('Category pattern analysis error:', error);
    return patterns;
  }
}

export async function forecastCashFlow(userId: string, monthsAhead: number = 3): Promise<CashFlowForecast[]> {
  const forecasts: CashFlowForecast[] = [];

  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type, transaction_date')
      .eq('user_id', userId)
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false });

    if (!transactions || transactions.length === 0) {
      return forecasts;
    }

    const monthlyData: Record<string, { income: number; expense: number }> = {};

    for (const txn of transactions) {
      const date = new Date(txn.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0 };
      }

      if (txn.type === 'income') {
        monthlyData[monthKey].income += Number(txn.amount);
      } else if (txn.type === 'expense') {
        monthlyData[monthKey].expense += Number(txn.amount);
      }
    }

    const sortedMonths = Object.keys(monthlyData).sort();
    const incomeValues = sortedMonths.map(m => monthlyData[m].income);
    const expenseValues = sortedMonths.map(m => monthlyData[m].expense);

    const avgIncome = incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length;
    const avgExpense = expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length;

    const recentIncomeTrend = calculateTrend(incomeValues.slice(-3));
    const recentExpenseTrend = calculateTrend(expenseValues.slice(-3));

    for (let i = 1; i <= monthsAhead; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);

      const predictedIncome = Math.max(0, avgIncome * (1 + recentIncomeTrend * 0.5));
      const predictedExpense = Math.max(0, avgExpense * (1 + recentExpenseTrend * 0.5));
      const predictedSavings = predictedIncome - predictedExpense;

      forecasts.push({
        month: futureDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        predictedIncome,
        predictedExpense,
        predictedSavings,
        confidence: 0.75,
      });
    }
  } catch (error) {
    console.error('Cash flow forecast error:', error);
  }

  return forecasts;
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;

  let sumXY = 0;
  let sumX = 0;
  let sumX2 = 0;
  let sumY = 0;

  for (let i = 0; i < values.length; i++) {
    sumXY += i * values[i];
    sumX += i;
    sumX2 += i * i;
    sumY += values[i];
  }

  const n = values.length;
  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumX2 - sumX * sumX;

  if (denominator === 0) return 0;

  const slope = numerator / denominator;
  const avgY = sumY / n;

  return avgY > 0 ? slope / avgY : 0;
}

export async function getSpendingHealthScore(userId: string): Promise<{
  score: number;
  category: string;
  breakdown: Record<string, number>;
}> {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .gte('transaction_date', oneMonthAgo.toISOString().split('T')[0]);

    if (!transactions || transactions.length === 0) {
      return { score: 0, category: 'No Data', breakdown: {} };
    }

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    if (income === 0) {
      return { score: 0, category: 'No Income', breakdown: {} };
    }

    const savingsRate = ((income - expense) / income) * 100;

    let score = 50;
    let category = 'Fair';

    if (savingsRate >= 35) {
      score = 95;
      category = 'Excellent';
    } else if (savingsRate >= 25) {
      score = 85;
      category = 'Very Good';
    } else if (savingsRate >= 15) {
      score = 70;
      category = 'Good';
    } else if (savingsRate >= 5) {
      score = 50;
      category = 'Fair';
    } else if (savingsRate >= 0) {
      score = 30;
      category = 'Needs Improvement';
    } else {
      score = 10;
      category = 'Critical';
    }

    const breakdown = {
      savingsRate: savingsRate,
      expenseToIncome: (expense / income) * 100,
      monthlyIncome: income,
      monthlyExpense: expense,
    };

    return { score, category, breakdown };
  } catch (error) {
    console.error('Health score calculation error:', error);
    return { score: 0, category: 'Error', breakdown: {} };
  }
}
