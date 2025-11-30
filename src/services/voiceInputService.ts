export interface VoiceTransaction {
  amount: number;
  category: string;
  description: string;
  type: 'income' | 'expense';
  date: string;
}

const AMOUNT_REGEX = /(\d+(?:[.,]\d+)?)/;
const CATEGORY_KEYWORDS = {
  food: ['food', 'eat', 'meal', 'lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'coffee'],
  transport: ['travel', 'uber', 'cab', 'petrol', 'fuel', 'bus', 'train', 'metro'],
  shopping: ['buy', 'shopping', 'clothes', 'shoes', 'dress', 'amazon', 'flipkart', 'mall'],
  entertainment: ['movie', 'cinema', 'game', 'netflix', 'spotify', 'entertainment'],
  bills: ['bill', 'electricity', 'water', 'internet', 'mobile', 'phone'],
  health: ['doctor', 'medicine', 'hospital', 'pharmacy', 'health', 'medical'],
  rent: ['rent', 'house', 'apartment', 'lease'],
  salary: ['salary', 'income', 'payment', 'received', 'credited'],
  freelance: ['freelance', 'project', 'work', 'client', 'payment received'],
};

export class VoiceInputProcessor {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.language = 'en-IN';
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  startListening(onResult: (text: string) => void, onError: (error: string) => void): void {
    if (!this.recognition) {
      onError('Voice input not supported in this browser');
      return;
    }

    this.isListening = true;
    let interimTranscript = '';

    this.recognition.onstart = () => {
      console.log('Voice recognition started');
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          onResult(transcript);
        } else {
          interimTranscript += transcript;
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      onError(`Voice error: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    this.recognition.start();
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getListeningStatus(): boolean {
    return this.isListening;
  }
}

export function parseVoiceTransaction(transcript: string): VoiceTransaction | null {
  try {
    const text = transcript.toLowerCase().trim();

    const amountMatch = text.match(AMOUNT_REGEX);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(',', '.'));

    let category = 'other';
    let type: 'income' | 'expense' = 'expense';

    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        category = cat;
        break;
      }
    }

    if (['salary', 'freelance'].includes(category)) {
      type = 'income';
    }

    const isIncome = text.includes('received') || text.includes('income') || text.includes('credited');
    if (isIncome) {
      type = 'income';
    }

    const isExpense = text.includes('spent') || text.includes('paid') || text.includes('bought');
    if (isExpense) {
      type = 'expense';
    }

    const description = text
      .replace(AMOUNT_REGEX, '')
      .replace(/rupees?|rs|₹/gi, '')
      .trim()
      .substring(0, 200);

    const today = new Date().toISOString().split('T')[0];

    return {
      amount,
      category,
      description: description || category,
      type,
      date: today,
    };
  } catch (error) {
    console.error('Voice parsing error:', error);
    return null;
  }
}

export function extractTransactionDetails(text: string): {
  amounts: number[];
  categories: string[];
  keywords: string[];
} {
  const amounts: number[] = [];
  const amountMatches = text.matchAll(/(\d+(?:[.,]\d+)?)/g);

  for (const match of amountMatches) {
    amounts.push(parseFloat(match[1].replace(',', '.')));
  }

  const categories: string[] = [];
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
      categories.push(cat);
    }
  }

  const keywordExtract = text
    .toLowerCase()
    .split(/[,\s]+/)
    .filter(word => word.length > 3)
    .slice(0, 10);

  return {
    amounts,
    categories: [...new Set(categories)],
    keywords: keywordExtract,
  };
}

export function formatVoiceTransactionForDisplay(transaction: VoiceTransaction): string {
  return `
    Type: ${transaction.type.toUpperCase()}
    Amount: ₹${transaction.amount}
    Category: ${transaction.category.toUpperCase()}
    Description: ${transaction.description}
    Date: ${transaction.date}
  `.trim();
}
