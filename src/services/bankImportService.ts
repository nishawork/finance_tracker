import * as Papa from 'papaparse';
import { supabase } from '../lib/supabase';

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  merchant: string;
  reference?: string;
}

const COMMON_CREDIT_KEYWORDS = [
  'salary', 'deposit', 'transfer in', 'credit', 'received', 'inward',
  'refund', 'reversal', 'income', 'payment received', 'proceeds'
];

const COMMON_DEBIT_KEYWORDS = [
  'debit', 'withdrawal', 'transfer out', 'payment', 'charge', 'fee',
  'outward', 'deducted', 'paid', 'expense', 'purchase'
];

function detectTransactionType(description: string): 'income' | 'expense' | 'transfer' {
  const desc = description.toLowerCase();

  const isCredit = COMMON_CREDIT_KEYWORDS.some(keyword => desc.includes(keyword));
  const isDebit = COMMON_DEBIT_KEYWORDS.some(keyword => desc.includes(keyword));

  if (isCredit && !isDebit) return 'income';
  if (isDebit && !isCredit) return 'expense';
  return 'transfer';
}

function extractMerchant(description: string): string {
  const desc = description.trim();

  const merchantPatterns = [
    /^([A-Za-z0-9\s&.-]+?)\s+(?:debit|credit|transfer|payment)/i,
    /(?:to|from)\s+([A-Za-z0-9\s&.-]+?)(?:\s+(?:on|ref|id))?/i,
    /([A-Za-z0-9\s&.-]+?)\s+(?:ref|id|#)?\d+/i,
  ];

  for (const pattern of merchantPatterns) {
    const match = desc.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      if (merchant.length > 2 && merchant.length < 100) {
        return merchant;
      }
    }
  }

  return desc.substring(0, 100);
}

function parseDate(dateStr: string): string | null {
  try {
    const formats = [
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
      /(\d{1,2})-([A-Za-z]{3})-(\d{4})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let d, m, y;

        if (match.length === 4) {
          if (parseInt(match[1]) > 31) {
            [y, m, d] = [match[1], match[2], match[3]];
          } else {
            [d, m, y] = [match[1], match[2], match[3]];
          }

          const date = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          if (date instanceof Date && !isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    }
  } catch (error) {
    console.error('Date parse error:', error);
  }
  return null;
}

export async function importCSVBankStatement(
  file: File,
  userId: string,
  accountId: string,
  options: {
    dateColumn: number;
    descriptionColumn: number;
    amountColumn: number;
    isCredit?: boolean;
  }
): Promise<BankTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transactions: BankTransaction[] = [];

          for (const row of results.data as any[]) {
            const dateStr = row[options.dateColumn];
            const description = row[options.descriptionColumn];
            const amountStr = row[options.amountColumn];

            if (!dateStr || !description || !amountStr) continue;

            const date = parseDate(dateStr);
            if (!date) continue;

            const amount = Math.abs(parseFloat(String(amountStr).replace(/,/g, '')));
            if (isNaN(amount) || amount <= 0) continue;

            const type = options.isCredit ? 'income' : detectTransactionType(description);

            transactions.push({
              date,
              description,
              amount,
              type,
              merchant: extractMerchant(description),
            });
          }

          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
}

export async function saveBankImportTransactions(
  transactions: BankTransaction[],
  userId: string,
  accountId: string,
  categoryId: string | null = null
): Promise<{ success: number; failed: number; duplicates: number }> {
  let success = 0;
  let failed = 0;
  let duplicates = 0;

  for (const txn of transactions) {
    try {
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('amount', txn.amount)
        .eq('transaction_date', txn.date)
        .eq('merchant', txn.merchant)
        .maybeSingle();

      if (existing) {
        duplicates++;
        continue;
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: accountId,
        amount: txn.amount,
        type: txn.type,
        merchant: txn.merchant,
        description: txn.description,
        transaction_date: txn.date,
        category_id: categoryId,
        source: 'import',
        raw_data: { import_source: 'bank_statement' },
      });

      if (!error) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
    }
  }

  return { success, failed, duplicates };
}

export async function detectBankCSVFormat(file: File): Promise<{
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
} | null> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      preview: 5,
      complete: (results) => {
        try {
          const firstRows = results.data as any[];
          if (firstRows.length === 0) {
            resolve(null);
            return;
          }

          const headerRow = firstRows[0];
          const datePatterns = ['date', 'transaction date', 'txn date', 'posting date'];
          const descPatterns = ['description', 'particulars', 'narration', 'details'];
          const amountPatterns = ['amount', 'debit', 'credit', 'value', 'transaction amount'];

          let dateColumn = -1;
          let descColumn = -1;
          let amountColumn = -1;

          for (let i = 0; i < headerRow.length; i++) {
            const header = String(headerRow[i]).toLowerCase().trim();

            if (dateColumn === -1 && datePatterns.some(p => header.includes(p))) {
              dateColumn = i;
            }
            if (descColumn === -1 && descPatterns.some(p => header.includes(p))) {
              descColumn = i;
            }
            if (amountColumn === -1 && amountPatterns.some(p => header.includes(p))) {
              amountColumn = i;
            }
          }

          if (dateColumn !== -1 && descColumn !== -1 && amountColumn !== -1) {
            resolve({ dateColumn, descriptionColumn: descColumn, amountColumn });
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      },
      error: () => resolve(null),
    });
  });
}
