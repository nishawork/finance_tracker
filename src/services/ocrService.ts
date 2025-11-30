import Tesseract from 'tesseract.js';
import { supabase } from '../lib/supabase';

export interface ParsedReceipt {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  items: Array<{ name: string; price: number }>;
  confidence: number;
}

const MERCHANT_PATTERNS = [
  /(?:store|shop|merchant):\s*(.+?)(?:\n|$)/i,
  /^(.+?)(?:\s+(?:bill|invoice|receipt))/i,
  /(?:from|at|paid to):\s*(.+?)(?:\n|$)/i,
];

const AMOUNT_PATTERNS = [
  /(?:total|amount|paid):\s*₹?\s*([\d,]+\.?\d*)/i,
  /₹\s*([\d,]+\.?\d*)\s*(?:total|final|amount)/i,
  /(?:total|grand).*?₹?\s*([\d,]+\.?\d*)/i,
];

const DATE_PATTERNS = [
  /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
  /(?:date|on):\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
];

function cleanAmount(amountStr: string): number {
  return parseFloat(amountStr.replace(/,/g, ''));
}

function extractPattern(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function parseDate(dateStr: string): string | null {
  try {
    const date = new Date(dateStr);
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    // Continue to next pattern
  }
  return null;
}

function extractItems(text: string): Array<{ name: string; price: number }> {
  const items: Array<{ name: string; price: number }> = [];
  const itemPattern = /(.+?)\s+₹?\s*([\d,]+\.?\d*)/gm;

  let match;
  while ((match = itemPattern.exec(text)) !== null) {
    try {
      const name = match[1].trim();
      const price = cleanAmount(match[2]);

      if (name.length > 2 && name.length < 100 && price > 0) {
        items.push({ name, price });
      }
    } catch (error) {
      continue;
    }
  }

  return items.slice(0, 10);
}

export async function processReceiptImage(imageFile: File, userId: string): Promise<ParsedReceipt | null> {
  try {
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onload = async (e) => {
        try {
          const imageData = e.target?.result as string;

          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            resolve(null);
            return;
          }

          const fileName = `receipts/${userId}/${Date.now()}-${imageFile.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(fileName, imageFile, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            resolve(null);
            return;
          }

          const { data: ocrResult } = await Tesseract.recognize(
            imageData,
            'eng',
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
              }
            }
          );

          const text = ocrResult?.data?.text || '';

          const merchantStr = extractPattern(text, MERCHANT_PATTERNS);
          const amountStr = extractPattern(text, AMOUNT_PATTERNS);
          const dateStr = extractPattern(text, DATE_PATTERNS);

          const parsed: ParsedReceipt = {
            merchant: merchantStr?.substring(0, 100) || null,
            amount: amountStr ? cleanAmount(amountStr) : null,
            date: dateStr ? parseDate(dateStr) : null,
            items: extractItems(text),
            confidence: ocrResult?.data?.confidence || 0,
          };

          const { error: dbError } = await supabase.from('receipts').insert({
            user_id: userId,
            image_url: uploadData?.path || '',
            ocr_raw: { text, confidence: parsed.confidence },
            parsed_merchant: parsed.merchant,
            parsed_amount: parsed.amount,
            parsed_date: parsed.date,
            parsed_items: parsed.items,
            processed: true,
          });

          if (dbError) {
            console.error('Database error:', dbError);
            resolve(null);
            return;
          }

          resolve(parsed);
        } catch (error) {
          console.error('OCR error:', error);
          resolve(null);
        }
      };

      reader.readAsDataURL(imageFile);
    });
  } catch (error) {
    console.error('Process receipt error:', error);
    return null;
  }
}

export async function createReceiptBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === 'receipts');

    if (!exists) {
      await supabase.storage.createBucket('receipts', {
        public: false,
        fileSizeLimit: 5242880,
      });
    }
  } catch (error) {
    console.error('Bucket creation error:', error);
  }
}
