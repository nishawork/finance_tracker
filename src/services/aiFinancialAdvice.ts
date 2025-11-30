import { supabase } from '../lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FinancialContext {
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number;
  totalBalance: number;
  recentTransactions: Array<{
    merchant: string;
    amount: number;
    type: string;
    date: string;
  }>;
  topExpenseCategories: Array<{ name: string; amount: number }>;
  budgets: Array<{ name: string; limit: number; spent: number }>;
}

export async function generateFinancialAdvice(
  question: string,
  context: FinancialContext
): Promise<string> {
  try {
    const systemPrompt = buildSystemPrompt(context);
    const userPrompt = buildUserPrompt(question, context);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI error:', error);
      return 'I encountered an error generating financial advice. Please try again.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Unable to generate advice at this moment.';
  } catch (error) {
    console.error('Financial advice error:', error);
    return 'Sorry, I could not generate financial advice right now. Please try again later.';
  }
}

function buildSystemPrompt(context: FinancialContext): string {
  return `You are an expert personal finance advisor for Indians. You provide practical, actionable financial advice based on the user's financial situation.

Current Financial Snapshot:
- Monthly Income: ₹${context.monthlyIncome.toLocaleString('en-IN')}
- Monthly Expense: ₹${context.monthlyExpense.toLocaleString('en-IN')}
- Savings Rate: ${(context.savingsRate).toFixed(1)}%
- Total Balance: ₹${context.totalBalance.toLocaleString('en-IN')}

Your responses should:
1. Be specific to their financial situation
2. Consider Indian financial context (taxes, investments, insurance)
3. Provide actionable steps they can take immediately
4. Be encouraging but realistic
5. Focus on sustainable habits and long-term wealth building
6. Mention rupees and use Indian financial products when relevant

Keep responses concise (2-3 short paragraphs) and practical.`;
}

function buildUserPrompt(question: string, context: FinancialContext): string {
  const topCategories = context.topExpenseCategories
    .slice(0, 3)
    .map(cat => `${cat.name}: ₹${cat.amount.toLocaleString('en-IN')}`)
    .join(', ');

  const budgetStatus = context.budgets
    .slice(0, 3)
    .map(b => `${b.name}: ₹${b.spent.toLocaleString('en-IN')} / ₹${b.limit.toLocaleString('en-IN')}`)
    .join(', ');

  return `
My financial situation:
- Top spending categories: ${topCategories}
- Budget status: ${budgetStatus}
- Recent major transactions: ${context.recentTransactions.slice(0, 2).map(t => `${t.merchant} (₹${t.amount.toLocaleString('en-IN')})`).join(', ')}

My question: ${question}
  `.trim();
}

export async function analyzeSpendingPatterns(
  userId: string,
  monthCount: number = 3
): Promise<string> {
  try {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - monthCount, 1);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type, merchant, transaction_date, categories(name)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false });

    if (!transactions || transactions.length === 0) {
      return 'Not enough transaction data to analyze spending patterns.';
    }

    const categorySpending: Record<string, number> = {};
    let totalSpending = 0;

    for (const txn of transactions) {
      const category = (txn.categories as any)?.name || 'Uncategorized';
      categorySpending[category] = (categorySpending[category] || 0) + Number(txn.amount);
      totalSpending += Number(txn.amount);
    }

    const topCategories = Object.entries(categorySpending)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, amount]) => `${cat}: ${((amount / totalSpending) * 100).toFixed(0)}%`)
      .join(', ');

    const analysis = `
Based on your last ${monthCount} months of spending:
- Total spent: ₹${totalSpending.toLocaleString('en-IN')}
- Transaction count: ${transactions.length}
- Top spending categories: ${topCategories}

Your biggest spending opportunity is on ${Object.entries(categorySpending).sort(([, a], [, b]) => b - a)[0][0]}.
Consider setting a strict budget for this category to improve your savings rate.
    `.trim();

    return analysis;
  } catch (error) {
    console.error('Spending analysis error:', error);
    return 'Could not analyze spending patterns at this moment.';
  }
}

export async function getSavingsSuggestions(
  userId: string,
  targetAmount: number
): Promise<string> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);

    if (!transactions) return 'Unable to generate savings suggestions.';

    const monthlyExpense = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const reductionNeeded = targetAmount;
    const percentReduction = ((reductionNeeded / monthlyExpense) * 100).toFixed(0);

    const suggestions = [
      `Reduce discretionary spending by ${percentReduction}% (₹${reductionNeeded.toLocaleString('en-IN')})`,
      'Review and cancel unused subscriptions and memberships',
      'Negotiate bills (internet, mobile, insurance) quarterly',
      'Use public transport or carpool for commuting',
      'Cook at home more often instead of eating out',
    ];

    return `To save ₹${targetAmount.toLocaleString('en-IN')} monthly, focus on:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
  } catch (error) {
    console.error('Savings suggestions error:', error);
    return 'Could not generate savings suggestions.';
  }
}

export async function getDebtRepaymentStrategy(
  userId: string
): Promise<string> {
  try {
    const { data: loans } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!loans || loans.length === 0) {
      return 'No active loans found. Great job staying out of debt!';
    }

    loans.sort((a, b) => {
      const aRatio = Number(a.interest_rate) / Number(a.remaining_amount);
      const bRatio = Number(b.interest_rate) / Number(b.remaining_amount);
      return bRatio - aRatio;
    });

    const priorityLoan = loans[0];
    const totalDebt = loans.reduce((sum, l) => sum + Number(l.remaining_amount), 0);

    const strategy = `
Debt Repayment Strategy (Avalanche Method):
1. Priority: Pay extra on "${priorityLoan.name}" (highest interest rate)
2. Continue minimum payments on other loans
3. Total remaining debt: ₹${totalDebt.toLocaleString('en-IN')}

Focus on clearing the highest interest loan first (${priorityLoan.interest_rate}% interest rate).
Once cleared, redirect that payment to the next loan.

Estimated timeline: ${estimateDebtFreedom(loans)} months
    `.trim();

    return strategy;
  } catch (error) {
    console.error('Debt strategy error:', error);
    return 'Could not generate debt repayment strategy.';
  }
}

function estimateDebtFreedom(loans: any[]): number {
  const totalDebt = loans.reduce((sum, l) => sum + Number(l.remaining_amount), 0);
  const totalEMI = loans.reduce((sum, l) => sum + (Number(l.emi_amount) || 0), 0);

  if (totalEMI === 0) return 0;

  return Math.ceil(totalDebt / totalEMI);
}

export async function getInvestmentAdvice(
  userId: string
): Promise<string> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .gte('transaction_date', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);

    if (!transactions) return 'Unable to generate investment advice.';

    const monthlyIncome = transactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const monthlyExpense = transactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const monthlySavings = monthlyIncome - monthlyExpense;
    const savingsRate = monthlyIncome > 0 ? ((monthlySavings / monthlyIncome) * 100).toFixed(1) : '0';

    if (monthlySavings < 5000) {
      return `Your current monthly savings (₹${monthlySavings.toLocaleString('en-IN')}) are too low for investments.
Focus on increasing savings to at least ₹10,000 before investing.
Build an emergency fund first (3-6 months of expenses).`;
    }

    const investmentAdvice = `
Investment Allocation for ₹${monthlySavings.toLocaleString('en-IN')} Monthly Savings:

Recommended Portfolio (Age & Risk Profile dependent):
- Emergency Fund (3-6 months): Build first
- High-Interest Savings Account: 20-30%
- Equity Mutual Funds (SIP): 40-50%
- Debt Mutual Funds: 20-30%
- Gold/Real Estate: 10% (Long-term)

Next Steps:
1. Start SIP in diversified equity mutual funds
2. Consider tax-saving schemes (ELSS)
3. Review insurance coverage
4. Plan for long-term goals with inflation-adjusted targets
    `.trim();

    return investmentAdvice;
  } catch (error) {
    console.error('Investment advice error:', error);
    return 'Could not generate investment advice.';
  }
}
