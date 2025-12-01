import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Search, Filter, Edit2, Trash2, X, Check, Calendar, Upload, Eye, Trash, Copy, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SMSImportModal } from './SMSImportModal';
import { ReceiptScannerModal } from './ReceiptScannerModal';
import { TransactionListSkeleton, EmptyState } from './utils';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  merchant: string | null;
  description: string | null;
  transaction_date: string;
  category_id: string | null;
  category_name: string;
  category_icon: string;
  account_id: string;
  account_name: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Account {
  id: string;
  name: string;
}

interface BulkActionState {
  selectedIds: Set<string>;
  isSelecting: boolean;
}

export function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Transaction>>({});
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showSMSImport, setShowSMSImport] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([]);
  const [bulkSelection, setBulkSelection] = useState<BulkActionState>({ selectedIds: new Set(), isSelecting: false });
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadCategoriesAndAccounts();
  }, [user]);

  const loadCategoriesAndAccounts = async () => {
    if (!user) return;

    const [categoriesRes, accountsRes] = await Promise.all([
      supabase.from('categories').select('id, name, icon'),
      supabase.from('accounts').select('id, name').eq('user_id', user.id),
    ]);

    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (accountsRes.data) setAccounts(accountsRes.data);
  };

  const loadTransactions = async () => {
    if (!user) return;

    let query = supabase
      .from('transactions')
      .select(`
        id,
        amount,
        type,
        merchant,
        description,
        transaction_date,
        category_id,
        account_id,
        categories(name, icon),
        accounts(name)
      `)
      .eq('user_id', user.id);

    if (dateRange.from) {
      query = query.gte('transaction_date', dateRange.from);
    }
    if (dateRange.to) {
      query = query.lte('transaction_date', dateRange.to);
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading transactions:', error);
      return;
    }

    if (data) {
      const formatted = data.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        merchant: t.merchant,
        description: t.description,
        transaction_date: t.transaction_date,
        category_id: t.category_id,
        category_name: t.categories?.name || 'Uncategorized',
        category_icon: t.categories?.icon || '📦',
        account_id: t.account_id,
        account_name: t.accounts?.name || 'Unknown',
      }));
      setTransactions(formatted);
    }

    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const txn = transactions.find(t => t.id === id);
    if (!txn || !user) return;

    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      alert('Failed to delete transaction');
      return;
    }

    const { data: accountData } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', txn.account_id)
      .maybeSingle();

    if (accountData) {
      const currentBalance = Number(accountData.balance);
      const newBalance = txn.type === 'income'
        ? currentBalance - txn.amount
        : currentBalance + txn.amount;

      await supabase
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', txn.account_id);
    }

    setTransactions(transactions.filter(t => t.id !== id));
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditFormData(transaction);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !user) return;

    const txn = transactions.find(t => t.id === editingId);
    if (!txn) return;

    const amountDifference = Number(editFormData.amount || txn.amount) - txn.amount;

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        amount: editFormData.amount,
        merchant: editFormData.merchant,
        description: editFormData.description,
        transaction_date: editFormData.transaction_date,
        category_id: editFormData.category_id,
      })
      .eq('id', editingId)
      .eq('user_id', user.id);

    if (updateError) {
      alert('Failed to update transaction');
      return;
    }

    if (amountDifference !== 0) {
      const { data: accountData } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', txn.account_id)
        .maybeSingle();

      if (accountData) {
        const currentBalance = Number(accountData.balance);
        const newBalance = txn.type === 'income'
          ? currentBalance + amountDifference
          : currentBalance - amountDifference;

        await supabase
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', txn.account_id);
      }
    }

    setTransactions(transactions.map(t =>
      t.id === editingId ? {
        ...t,
        ...editFormData,
        category_name: categories.find(c => c.id === editFormData.category_id)?.name || t.category_name,
        category_icon: categories.find(c => c.id === editFormData.category_id)?.icon || t.category_icon,
      } : t
    ));
    setEditingId(null);
    setEditFormData({});
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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getMerchantSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setMerchantSuggestions([]);
      return;
    }

    const unique = [...new Set(transactions
      .filter(t => t.merchant?.toLowerCase().includes(input.toLowerCase()))
      .map(t => t.merchant)
      .filter(Boolean))];

    setMerchantSuggestions(unique.slice(0, 5));
  };

  const handleBulkSelect = (id: string) => {
    const newSelected = new Set(bulkSelection.selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setBulkSelection({ ...bulkSelection, selectedIds: newSelected });
  };

  const handleSelectAll = () => {
    if (bulkSelection.selectedIds.size === filteredTransactions.length) {
      setBulkSelection({ selectedIds: new Set(), isSelecting: false });
    } else {
      const allIds = new Set(filteredTransactions.map(t => t.id));
      setBulkSelection({ selectedIds: allIds, isSelecting: true });
    }
  };

  const handleBulkDelete = async () => {
    if (bulkSelection.selectedIds.size === 0) return;
    if (!confirm(`Delete ${bulkSelection.selectedIds.size} transactions?`)) return;

    for (const id of Array.from(bulkSelection.selectedIds)) {
      await handleDelete(id);
    }
    setBulkSelection({ selectedIds: new Set(), isSelecting: false });
  };

  const [amountRange, setAmountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === 'all' || t.type === filterType;

    const minAmount = amountRange.min ? parseFloat(amountRange.min) : 0;
    const maxAmount = amountRange.max ? parseFloat(amountRange.max) : Infinity;
    const matchesAmount = t.amount >= minAmount && t.amount <= maxAmount;

    return matchesSearch && matchesFilter && matchesAmount;
  });

  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

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
          <h2 className="text-3xl font-bold text-gray-900">Transactions</h2>
          <p className="text-gray-600 mt-1">View and manage all your transactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSMSImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
            title="Import SMS transactions"
          >
            <Upload size={18} />
            <span className="hidden sm:inline">Import SMS</span>
          </button>
          <button
            onClick={() => setShowReceiptScanner(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
            title="Scan receipts"
          >
            <Eye size={18} />
            <span className="hidden sm:inline">Scan Receipt</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-1">Total Income</div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-1">Total Expense</div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-1">Net</div>
          <div className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(totalIncome - totalExpense)}
          </div>
        </div>
      </div>

      {bulkSelection.selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold">
              {bulkSelection.selectedIds.size}
            </div>
            <span className="text-sm text-blue-700 font-medium">
              {bulkSelection.selectedIds.size} transaction{bulkSelection.selectedIds.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkSelection({ selectedIds: new Set(), isSelecting: false })}
              className="px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition"
            >
              Deselect
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition flex items-center gap-2"
            >
              <Trash size={16} />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2 flex-1">
                <Calendar size={18} className="text-gray-400" />
                <span className="text-sm text-gray-600 min-w-fit">Date Range:</span>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => {
                    setDateRange({ ...dateRange, from: e.target.value });
                    loadTransactions();
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => {
                    setDateRange({ ...dateRange, to: e.target.value });
                    loadTransactions();
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
                {(dateRange.from || dateRange.to) && (
                  <button
                    onClick={() => {
                      setDateRange({ from: '', to: '' });
                      loadTransactions();
                    }}
                    className="text-sm text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-gray-600 min-w-fit">Amount Range:</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={amountRange.min}
                    onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-gray-400">-</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={amountRange.max}
                    onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {(amountRange.min || amountRange.max) && (
                  <button
                    onClick={() => setAmountRange({ min: '', max: '' })}
                    className="text-sm text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm || filterType !== 'all' || dateRange.from || dateRange.to
                ? 'No transactions found matching your filters'
                : 'No transactions yet. Add your first transaction!'}
            </div>
          ) : (
            <>
              <div className="p-4 flex items-center gap-4 bg-gray-50 border-b border-gray-100">
                <input
                  type="checkbox"
                  checked={bulkSelection.selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                  onChange={handleSelectAll}
                  className="w-5 h-5 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-600 font-medium">
                  {bulkSelection.selectedIds.size > 0
                    ? `${bulkSelection.selectedIds.size} selected`
                    : `${filteredTransactions.length} transactions`}
                </span>
              </div>
              {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="p-4 hover:bg-gray-50 transition">
                {editingId === transaction.id ? (
                  <EditTransactionRow
                    transaction={transaction}
                    editFormData={editFormData}
                    setEditFormData={setEditFormData}
                    categories={categories}
                    accounts={accounts}
                    onSave={handleSaveEdit}
                    onCancel={() => {
                      setEditingId(null);
                      setEditFormData({});
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="checkbox"
                      checked={bulkSelection.selectedIds.has(transaction.id)}
                      onChange={() => handleBulkSelect(transaction.id)}
                      className="w-5 h-5 rounded cursor-pointer flex-shrink-0"
                    />
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          transaction.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'
                        }`}
                      >
                        {transaction.type === 'income' ? (
                          <ArrowUpRight className="text-emerald-600" size={24} />
                        ) : (
                          <ArrowDownRight className="text-red-600" size={24} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <span>{transaction.category_icon}</span>
                          <span className="truncate">{transaction.merchant || transaction.category_name}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {transaction.account_name} • {formatDate(transaction.transaction_date)}
                        </div>
                        {transaction.description && (
                          <div className="text-sm text-gray-600 mt-1 truncate">{transaction.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div
                        className={`text-lg font-bold whitespace-nowrap ${
                          transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </div>
                      <button
                        onClick={() => handleEdit(transaction)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 size={18} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={18} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            </>
          )}
        </div>
      </div>

      <SMSImportModal
        isOpen={showSMSImport}
        onClose={() => setShowSMSImport(false)}
        onSuccess={() => {
          loadTransactions();
          setShowSMSImport(false);
        }}
      />

      <ReceiptScannerModal
        isOpen={showReceiptScanner}
        onClose={() => setShowReceiptScanner(false)}
        onSuccess={() => {
          loadTransactions();
          setShowReceiptScanner(false);
        }}
      />
    </div>
  );
}

interface EditTransactionRowProps {
  transaction: Transaction;
  editFormData: Partial<Transaction>;
  setEditFormData: (data: Partial<Transaction>) => void;
  categories: Category[];
  accounts: Account[];
  onSave: () => void;
  onCancel: () => void;
}

function EditTransactionRow({
  transaction,
  editFormData,
  setEditFormData,
  categories,
  accounts,
  onSave,
  onCancel,
}: EditTransactionRowProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
            <input
              type="number"
              step="0.01"
              value={editFormData.amount || ''}
              onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) })}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={editFormData.transaction_date || ''}
            onChange={(e) => setEditFormData({ ...editFormData, transaction_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={editFormData.category_id || ''}
            onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Merchant</label>
          <input
            type="text"
            value={editFormData.merchant || ''}
            onChange={(e) => setEditFormData({ ...editFormData, merchant: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            placeholder="Merchant name"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={editFormData.description || ''}
          onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          placeholder="Add notes..."
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
        >
          <X size={16} className="inline mr-1" />
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
        >
          <Check size={16} className="inline mr-1" />
          Save
        </button>
      </div>
    </div>
  );
}
