# Quick Start Guide - AI Finance Budget Tracker

## Getting Started

### 1. Setup Environment Variables
Create or update `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENAI_API_KEY=sk-your-openai-key
```

### 2. Start Development Server
```bash
npm run dev
```
Visit `http://localhost:5173`

### 3. Build for Production
```bash
npm run build
```

---

## New Features Overview

### 1. OCR Receipt Scanning 📸
**Location**: Dashboard → Add Transaction → Attach Receipt

Usage:
```typescript
import { processReceiptImage } from './services/ocrService';

const parsed = await processReceiptImage(imageFile, userId);
console.log(parsed.merchant, parsed.amount, parsed.date);
```

**Features**:
- Automatic merchant extraction
- Amount detection
- Date parsing
- Item line extraction
- Confidence scoring

---

### 2. Bank Statement Import 📊
**Location**: Dashboard → Accounts → Import Statement

Usage:
```typescript
import { importCSVBankStatement, saveBankImportTransactions } from './services/bankImportService';

const transactions = await importCSVBankStatement(file, userId, accountId, {
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
});

await saveBankImportTransactions(transactions, userId, accountId);
```

**Features**:
- Auto-format detection
- CSV/Excel support
- Transaction classification
- Duplicate prevention

---

### 3. Voice Input 🎤
**Location**: Dashboard → Quick Add → Voice Icon

Usage:
```typescript
import { VoiceInputProcessor, parseVoiceTransaction } from './services/voiceInputService';

const processor = new VoiceInputProcessor();
processor.startListening(
  (transcript) => {
    const txn = parseVoiceTransaction(transcript);
    // "Add 250 rupees for food" → expense of ₹250 in Food category
  },
  (error) => console.error(error)
);
```

**Examples**:
- "Add 500 for groceries"
- "Spent 100 on cab"
- "Received salary 50000"
- "Movie 350 rupees"

---

### 4. Recurring Transactions 🔄
**Location**: Dashboard → Transactions → Detect Recurring

Usage:
```typescript
import { detectRecurringTransactions, createRecurringRule } from './services/recurringTransactionService';

// Auto-detect patterns
const suggestions = await detectRecurringTransactions(userId);

// Create manual rule
await createRecurringRule({
  user_id: userId,
  merchant: 'Netflix',
  amount: 499,
  frequency: 'monthly',
  start_date: '2024-01-01',
  next_occurrence: '2024-12-01',
  auto_create: true,
});
```

**Supported Frequencies**: daily, weekly, biweekly, monthly, quarterly, yearly

---

### 5. AI Financial Advisor 💬
**Location**: Sidebar → AI Advisor

Features:
- **Chat Interface**: Ask financial questions
- **Spending Analysis**: Understand spending patterns
- **Savings Tips**: Get personalized recommendations
- **Debt Strategy**: Avalanche/Snowball methods
- **Investment Advice**: Asset allocation

**Quick Questions**:
- "How can I save more?"
- "Analyze my spending"
- "Investment advice"
- "Debt repayment strategy"

Usage:
```typescript
import { generateFinancialAdvice } from './services/aiFinancialAdvice';

const advice = await generateFinancialAdvice(
  "How can I save 10000 more per month?",
  financialContext
);
```

---

### 6. Anomaly Detection 🚨
**Automatic Detection**: Runs on Dashboard load

Usage:
```typescript
import { detectAnomalies } from './services/advancedAnalytics';

const alerts = await detectAnomalies(userId);
alerts.forEach(alert => {
  console.log(`${alert.type}: ${alert.description}`);
});
```

**Types**:
- Sudden spending spikes
- Unusual category transactions
- Duplicate transactions
- Pattern breaks

---

### 7. Cash Flow Forecasting 📈
**Location**: Reports → Predictions

Usage:
```typescript
import { forecastCashFlow } from './services/advancedAnalytics';

const forecast = await forecastCashFlow(userId, 3); // 3 months ahead
forecast.forEach(month => {
  console.log(`${month.month}: Income ₹${month.predictedIncome}`);
});
```

---

### 8. Notifications 📬

#### Budget Alerts (50%, 80%, 100%)
- Automatic when spending crosses thresholds
- Customizable per budget

#### Subscription Reminders
- 3 days before renewal
- Amount and due date shown

#### EMI Reminders
- 7 days before payment
- Auto-detected from loan configuration

#### Spending Anomalies
- Automatic when unusual spending detected
- Shows vs. historical average

Usage:
```typescript
import { checkBudgetAlerts, sendNotification } from './services/notificationService';

// Run daily
await checkBudgetAlerts(userId);
await checkSubscriptionReminders(userId);
await checkEmiReminders(userId);
await checkSpendingAnomalies(userId);

// Or manually send
await sendNotification({
  userId,
  type: 'budget_alert',
  title: 'Budget Alert',
  message: 'You reached 80% of your food budget',
  data: { category: 'Food', spent: 1600, limit: 2000 }
});
```

---

### 9. Interactive Charts 📊

Charts on Reports page:
1. **Income vs Expense** - Bar chart showing monthly trends
2. **Category Breakdown** - Pie chart with percentages
3. **Savings Rate** - Trend chart over months

Usage:
```typescript
import { SpendingTrendChart, CategoryBreakdownChart } from './components/charts/SpendingChart';

<SpendingTrendChart data={monthlyData} />
<CategoryBreakdownChart categoryData={categoryData} />
```

---

## Database Tables Added

### recurring_rules
```sql
SELECT * FROM recurring_rules
WHERE user_id = auth.uid()
AND is_active = true
ORDER BY next_occurrence;
```

### notifications_log
```sql
SELECT * FROM notifications_log
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 50;
```

### chat_messages
```sql
SELECT * FROM chat_messages
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 100;
```

---

## API Endpoints

### Send Notification
```bash
POST /functions/v1/send-notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "type": "budget_alert",
  "title": "Budget Alert",
  "message": "You've spent 80% of your budget",
  "data": { "category": "Food", "spent": 1600, "limit": 2000 }
}
```

---

## Configuration

### OpenAI Integration
Add your API key to `.env`:
```env
VITE_OPENAI_API_KEY=sk-...
```

The AI advisor uses GPT-3.5-turbo by default. To change:
Edit `src/services/aiFinancialAdvice.ts` line with `model: 'gpt-3.5-turbo'`

### Notification Thresholds
Edit `src/services/notificationService.ts`:
```typescript
// Budget alert threshold (default 80%)
const alertThreshold = budget.alert_at_percentage || 80;

// Subscription reminder (default 3 days)
threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

// EMI reminder (default 7 days)
sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
```

---

## Common Issues & Solutions

### OCR not recognizing text
- Ensure image is clear and well-lit
- Try manual entry as backup
- Check Tesseract.js loading in browser console

### Bank import not detecting format
- Ensure CSV has headers
- Check column order (date, description, amount)
- Use "Detect Format" button

### Voice input not working
- Allow microphone permission when prompted
- Check browser supports Web Speech API (Chrome/Edge)
- Ensure audio input device is working

### OpenAI errors
- Verify API key is correct
- Check account has available credits
- Review rate limits

---

## Performance Tips

1. **Lazy load charts**: Import components only when needed
2. **Pagination**: Use limits in queries
3. **Caching**: Supabase client caches automatically
4. **Batch operations**: Use Promise.all() for parallel queries

---

## Monitoring

Check browser console for:
- OCR progress: `"OCR Progress: 45%"`
- API calls: Network tab
- Errors: `console.error()` messages

Check Supabase dashboard:
- Function logs: Functions → Logs
- Database: SQL Editor
- Storage: Storage Browser

---

## Next Steps

1. ✅ Setup `.env` with API keys
2. ✅ Test login/authentication
3. ✅ Create test transactions
4. ✅ Try OCR with receipt image
5. ✅ Test voice input
6. ✅ Import bank statement
7. ✅ Check AI advisor responses
8. ✅ Verify charts render
9. ✅ Test recurring transaction detection
10. ✅ Monitor notification alerts

---

## Support

For issues or questions:
1. Check console for error messages
2. Review IMPLEMENTATION_SUMMARY.md for technical details
3. Check Supabase logs for backend errors
4. Verify all environment variables are set

---

Last Updated: November 30, 2025
