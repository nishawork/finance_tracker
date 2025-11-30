import { useState, useEffect, useRef } from 'react';
import { Send, Loader, MessageCircle, TrendingUp, PiggyBank, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  generateFinancialAdvice,
  analyzeSpendingPatterns,
  getSavingsSuggestions,
  getDebtRepaymentStrategy,
  getInvestmentAdvice,
  FinancialContext,
} from '../services/aiFinancialAdvice';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_QUESTIONS = [
  { icon: TrendingUp, text: 'How can I save more?', color: 'text-emerald-600' },
  { icon: AlertCircle, text: 'Spending analysis', color: 'text-amber-600' },
  { icon: PiggyBank, text: 'Investment advice', color: 'text-blue-600' },
];

export function AiFinancialAdvisor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<FinancialContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFinancialContext();
    loadChatHistory();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadFinancialContext = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const [accountsRes, transactionsRes, categoriesRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('balance')
          .eq('user_id', user.id)
          .eq('is_active', true),

        supabase
          .from('transactions')
          .select('amount, type, merchant, transaction_date, category_id, categories(name)')
          .eq('user_id', user.id)
          .gte('transaction_date', startOfMonth),

        supabase
          .from('budgets')
          .select('name, amount, category_id')
          .eq('user_id', user.id)
          .eq('is_active', true),
      ]);

      if (transactionsRes.data && accountsRes.data && categoriesRes.data) {
        const income = transactionsRes.data
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const expense = transactionsRes.data
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const totalBalance = accountsRes.data.reduce((sum, acc) => sum + Number(acc.balance), 0);

        const categorySpending: Record<string, number> = {};
        transactionsRes.data.forEach(t => {
          if (t.type === 'expense' && (t.categories as any)?.name) {
            const cat = (t.categories as any).name;
            categorySpending[cat] = (categorySpending[cat] || 0) + Number(t.amount);
          }
        });

        const topExpenseCategories = Object.entries(categorySpending)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, amount]) => ({ name, amount }));

        const budgets = categoriesRes.data.map(b => ({
          name: b.name,
          limit: Number(b.amount),
          spent: categorySpending[b.name] || 0,
        }));

        const recentTransactions = transactionsRes.data
          .slice(-5)
          .map(t => ({
            merchant: t.merchant || 'Unknown',
            amount: Number(t.amount),
            type: t.type,
            date: t.transaction_date,
          }));

        setContext({
          monthlyIncome: income,
          monthlyExpense: expense,
          savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
          totalBalance,
          recentTransactions,
          topExpenseCategories,
          budgets,
        });
      }
    } catch (error) {
      console.error('Load context error:', error);
    }
  };

  const loadChatHistory = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data) {
        setMessages(
          data.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
          }))
        );
      }
    } catch (error) {
      console.error('Load chat history error:', error);
    }
  };

  const handleQuickQuestion = async (question: string) => {
    setInput(question);
    await sendMessage(question);
  };

  const sendMessage = async (text: string) => {
    if (!user || !context || !text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let response = '';

      if (text.toLowerCase().includes('save')) {
        response = await getSavingsSuggestions(user.id, 5000);
      } else if (text.toLowerCase().includes('spending')) {
        response = await analyzeSpendingPatterns(user.id, 3);
      } else if (text.toLowerCase().includes('investment')) {
        response = await getInvestmentAdvice(user.id);
      } else if (text.toLowerCase().includes('debt') || text.toLowerCase().includes('loan')) {
        response = await getDebtRepaymentStrategy(user.id);
      } else {
        response = await generateFinancialAdvice(text, context);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'user',
        content: text,
      });

      await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: response,
      });
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="text-emerald-600" size={32} />
            AI Financial Advisor
          </h2>
          <p className="text-gray-600 mt-1">Get personalized financial insights and advice</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ height: '600px' }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <MessageCircle className="text-gray-300" size={48} />
              <p className="text-gray-500 mt-4">No messages yet. Ask me anything about your finances!</p>

              {context && (
                <div className="mt-8 space-y-2 w-full max-w-sm">
                  <p className="text-sm text-gray-600 font-semibold mb-4">Quick questions:</p>
                  {QUICK_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(q.text)}
                      className="w-full flex items-center gap-3 p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition border border-gray-200"
                    >
                      <q.icon className={`${q.color} flex-shrink-0`} size={20} />
                      <span className="text-gray-700 text-sm">{q.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-emerald-100' : 'text-gray-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader className="animate-spin" size={16} />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter' && !loading) {
                  sendMessage(input);
                }
              }}
              placeholder="Ask me about your finances..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              {loading ? <Loader className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
