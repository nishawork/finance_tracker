import { supabase } from '../lib/supabase';

export interface NotificationPayload {
  userId: string;
  type: 'budget_alert' | 'subscription_reminder' | 'spending_anomaly' | 'emi_reminder' | 'salary_alert';
  title: string;
  message: string;
  data?: Record<string, any>;
}

export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Send notification error:', error);
    return false;
  }
}

export async function checkBudgetAlerts(userId: string): Promise<void> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const { data: budgets } = await supabase
      .from('budgets')
      .select('id, name, amount, category_id, alert_at_percentage')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!budgets) return;

    for (const budget of budgets) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('transaction_date', startOfMonth);

      if (!transactions) continue;

      let spent = 0;

      if (budget.category_id) {
        spent = transactions
          .filter(t => {
            const { data: txn } = supabase
              .from('transactions')
              .select('category_id')
              .eq('id', t.id)
              .maybeSingle();
            return (txn as any)?.category_id === budget.category_id;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0);
      } else {
        spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
      }

      const percentage = (spent / Number(budget.amount)) * 100;
      const alertThreshold = budget.alert_at_percentage || 80;

      if (percentage >= alertThreshold) {
        await sendNotification({
          userId,
          type: 'budget_alert',
          title: '📊 Budget Alert',
          message: `You've used ${percentage.toFixed(0)}% of your ${budget.name} budget`,
          data: {
            category: budget.name,
            spent: spent.toFixed(2),
            limit: budget.amount,
            percentage: percentage.toFixed(0),
          },
        });
      }
    }
  } catch (error) {
    console.error('Budget alert check error:', error);
  }
}

export async function checkSubscriptionReminders(userId: string): Promise<void> {
  try {
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('id, name, amount, next_billing_date')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('next_billing_date', threeDaysFromNow.toISOString().split('T')[0])
      .gte('next_billing_date', today.toISOString().split('T')[0]);

    if (!subscriptions) return;

    for (const sub of subscriptions) {
      const { data: notificationSent } = await supabase
        .from('notifications_log')
        .select('id')
        .eq('subscription_id', sub.id)
        .eq('type', 'subscription_reminder')
        .gte('created_at', today.toISOString())
        .maybeSingle();

      if (!notificationSent) {
        await sendNotification({
          userId,
          type: 'subscription_reminder',
          title: '🔄 Subscription Reminder',
          message: `Your ${sub.name} subscription will renew soon`,
          data: {
            subscription: sub.name,
            amount: sub.amount,
            dueDate: sub.next_billing_date,
          },
        });

        await supabase.from('notifications_log').insert({
          user_id: userId,
          subscription_id: sub.id,
          type: 'subscription_reminder',
        });
      }
    }
  } catch (error) {
    console.error('Subscription reminder check error:', error);
  }
}

export async function checkEmiReminders(userId: string): Promise<void> {
  try {
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: loans } = await supabase
      .from('loans')
      .select('id, name, emi_amount, emi_day')
      .eq('user_id', userId);

    if (!loans) return;

    for (const loan of loans) {
      if (!loan.emi_day) continue;

      const nextEmi = getNextEmiDate(loan.emi_day);

      if (nextEmi >= today && nextEmi <= sevenDaysFromNow) {
        const { data: notificationSent } = await supabase
          .from('notifications_log')
          .select('id')
          .eq('loan_id', loan.id)
          .eq('type', 'emi_reminder')
          .gte('created_at', today.toISOString())
          .maybeSingle();

        if (!notificationSent) {
          await sendNotification({
            userId,
            type: 'emi_reminder',
            title: '💳 EMI Payment Due',
            message: `EMI payment for ${loan.name} is due soon`,
            data: {
              loanName: loan.name,
              emiAmount: loan.emi_amount,
              dueDate: nextEmi.toISOString().split('T')[0],
            },
          });

          await supabase.from('notifications_log').insert({
            user_id: userId,
            loan_id: loan.id,
            type: 'emi_reminder',
          });
        }
      }
    }
  } catch (error) {
    console.error('EMI reminder check error:', error);
  }
}

export async function checkSpendingAnomalies(userId: string): Promise<void> {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('id, amount, merchant, category_id')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', oneWeekAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false })
      .limit(10);

    if (!recentTransactions || recentTransactions.length === 0) return;

    for (const txn of recentTransactions) {
      const { data: historicalTransactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .eq('category_id', txn.category_id)
        .neq('id', txn.id)
        .lt('transaction_date', oneWeekAgo.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false })
        .limit(20);

      if (!historicalTransactions || historicalTransactions.length < 3) continue;

      const amounts = historicalTransactions.map(t => Number(t.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - avgAmount, 2), 0) / amounts.length);

      if (Number(txn.amount) > avgAmount + 2 * stdDev) {
        const { data: notificationSent } = await supabase
          .from('notifications_log')
          .select('id')
          .eq('transaction_id', txn.id)
          .eq('type', 'spending_anomaly')
          .maybeSingle();

        if (!notificationSent) {
          await sendNotification({
            userId,
            type: 'spending_anomaly',
            title: '⚠️ Unusual Spending Detected',
            message: `You spent significantly more than usual on this transaction`,
            data: {
              amount: Number(txn.amount),
              average: avgAmount,
              merchant: txn.merchant,
            },
          });

          await supabase.from('notifications_log').insert({
            user_id: userId,
            transaction_id: txn.id,
            type: 'spending_anomaly',
          });
        }
      }
    }
  } catch (error) {
    console.error('Spending anomaly check error:', error);
  }
}

export async function runDailyNotificationChecks(userId: string): Promise<void> {
  console.log(`Running notification checks for user ${userId}`);
  await Promise.allSettled([
    checkBudgetAlerts(userId),
    checkSubscriptionReminders(userId),
    checkEmiReminders(userId),
    checkSpendingAnomalies(userId),
  ]);
}

function getNextEmiDate(emiDay: number): Date {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, emiDay);

  if (nextMonth > today) {
    return nextMonth;
  } else {
    return new Date(today.getFullYear(), today.getMonth() + 2, emiDay);
  }
}
