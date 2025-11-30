import { supabase } from '../lib/supabase';

export interface RecurringRule {
  id?: string;
  user_id: string;
  category_id?: string;
  account_id: string;
  merchant: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string;
  next_occurrence: string;
  is_active: boolean;
  auto_create: boolean;
}

export interface RecurringTransactionCheck {
  rulesTriggered: RecurringRule[];
  transactionsCreated: number;
  failedCreations: number;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getNextOccurrence(lastDate: Date, frequency: string): Date {
  switch (frequency) {
    case 'daily':
      return addDays(lastDate, 1);
    case 'weekly':
      return addDays(lastDate, 7);
    case 'biweekly':
      return addDays(lastDate, 14);
    case 'monthly':
      return addMonths(lastDate, 1);
    case 'quarterly':
      return addMonths(lastDate, 3);
    case 'yearly':
      return addMonths(lastDate, 12);
    default:
      return addDays(lastDate, 1);
  }
}

export async function createRecurringRule(rule: Omit<RecurringRule, 'id'>): Promise<RecurringRule | null> {
  try {
    const { data, error } = await supabase
      .from('recurring_rules')
      .insert({
        user_id: rule.user_id,
        category_id: rule.category_id,
        account_id: rule.account_id,
        merchant: rule.merchant,
        amount: rule.amount,
        frequency: rule.frequency,
        start_date: rule.start_date,
        end_date: rule.end_date,
        next_occurrence: rule.next_occurrence,
        is_active: rule.is_active,
        auto_create: rule.auto_create,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating recurring rule:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Create recurring rule error:', error);
    return null;
  }
}

export async function checkAndCreateRecurringTransactions(userId: string): Promise<RecurringTransactionCheck> {
  const result: RecurringTransactionCheck = {
    rulesTriggered: [],
    transactionsCreated: 0,
    failedCreations: 0,
  };

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: rules, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('next_occurrence', today);

    if (error) {
      console.error('Error fetching recurring rules:', error);
      return result;
    }

    if (!rules || rules.length === 0) {
      return result;
    }

    for (const rule of rules) {
      const endDate = rule.end_date ? new Date(rule.end_date) : null;
      const nextDate = new Date(rule.next_occurrence);

      if (endDate && nextDate > endDate) {
        await supabase
          .from('recurring_rules')
          .update({ is_active: false })
          .eq('id', rule.id);
        continue;
      }

      if (rule.auto_create) {
        const { error: txnError } = await supabase.from('transactions').insert({
          user_id: userId,
          account_id: rule.account_id,
          category_id: rule.category_id,
          amount: rule.amount,
          type: 'expense',
          merchant: rule.merchant,
          description: `Recurring: ${rule.merchant}`,
          transaction_date: today,
          source: 'api',
          is_recurring: true,
          raw_data: { recurring_rule_id: rule.id },
        });

        if (!txnError) {
          result.transactionsCreated++;
        } else {
          result.failedCreations++;
        }
      }

      const nextOccurrence = getNextOccurrence(nextDate, rule.frequency);
      const nextOccurrenceStr = nextOccurrence.toISOString().split('T')[0];

      await supabase
        .from('recurring_rules')
        .update({ next_occurrence: nextOccurrenceStr })
        .eq('id', rule.id);

      result.rulesTriggered.push(rule);
    }
  } catch (error) {
    console.error('Check recurring transactions error:', error);
  }

  return result;
}

export async function detectRecurringTransactions(userId: string): Promise<RecurringRule[]> {
  const suggestions: RecurringRule[] = [];

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('merchant, amount, transaction_date, account_id, category_id')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false });

    if (error || !transactions) {
      return suggestions;
    }

    const merchantGroups: Record<string, typeof transactions> = {};

    for (const txn of transactions) {
      const key = `${txn.merchant}-${txn.amount}`;
      if (!merchantGroups[key]) {
        merchantGroups[key] = [];
      }
      merchantGroups[key].push(txn);
    }

    for (const [key, txns] of Object.entries(merchantGroups)) {
      if (txns.length < 2) continue;

      txns.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

      let totalDayDiff = 0;
      let count = 0;

      for (let i = 1; i < txns.length; i++) {
        const date1 = new Date(txns[i - 1].transaction_date);
        const date2 = new Date(txns[i].transaction_date);
        const dayDiff = Math.abs((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
        totalDayDiff += dayDiff;
        count++;
      }

      const avgDayDiff = totalDayDiff / count;

      let frequency: RecurringRule['frequency'] = 'monthly';

      if (avgDayDiff < 2) frequency = 'daily';
      else if (avgDayDiff < 10) frequency = 'weekly';
      else if (avgDayDiff < 20) frequency = 'biweekly';
      else if (avgDayDiff < 60) frequency = 'monthly';
      else if (avgDayDiff < 120) frequency = 'quarterly';
      else frequency = 'yearly';

      const nextDate = getNextOccurrence(new Date(txns[txns.length - 1].transaction_date), frequency);

      suggestions.push({
        user_id: userId,
        merchant: txns[0].merchant || 'Unknown',
        amount: txns[0].amount,
        frequency,
        start_date: txns[0].transaction_date,
        next_occurrence: nextDate.toISOString().split('T')[0],
        is_active: true,
        auto_create: false,
        account_id: txns[0].account_id,
        category_id: txns[0].category_id || undefined,
      });
    }
  } catch (error) {
    console.error('Detect recurring transactions error:', error);
  }

  return suggestions;
}

export async function getActiveRecurringRules(userId: string): Promise<RecurringRule[]> {
  try {
    const { data, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('next_occurrence', { ascending: true });

    if (error) {
      console.error('Error fetching recurring rules:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get recurring rules error:', error);
    return [];
  }
}

export async function updateRecurringRule(ruleId: string, updates: Partial<RecurringRule>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('recurring_rules')
      .update(updates)
      .eq('id', ruleId);

    if (error) {
      console.error('Error updating recurring rule:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Update recurring rule error:', error);
    return false;
  }
}

export async function deleteRecurringRule(ruleId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('Error deleting recurring rule:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete recurring rule error:', error);
    return false;
  }
}
