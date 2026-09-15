import { createWorker, Worker } from 'tesseract.js';

export interface ParsedPayslip {
  periodStart: string | null; // ISO
  periodEnd: string | null; // ISO
  grossPay: number | null;
  netPay: number | null;
  rawText: string;
}

/** Converts an Australian D/M/YYYY date (as printed on the payslip) to ISO yyyy-mm-dd. */
function auDateToISO(d: string): string | null {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseMoney(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

export function parsePayslipText(text: string): ParsedPayslip {
  const periodMatch = text.match(/Pay\s*Period\s*From:?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*To:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const grossMatch = text.match(/GROSS\s*PAY:?\s*\$?\s*([\d,]+\.\d{2})/i);
  const netMatch = text.match(/NET\s*PAY:?\s*\$?\s*([\d,]+\.\d{2})/i);

  return {
    periodStart: periodMatch ? auDateToISO(periodMatch[1]) : null,
    periodEnd: periodMatch ? auDateToISO(periodMatch[2]) : null,
    grossPay: grossMatch ? parseMoney(grossMatch[1]) : null,
    netPay: netMatch ? parseMoney(netMatch[1]) : null,
    rawText: text,
  };
}

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    // Self-hosted so OCR works even on restrictive networks (e.g. hospital wifi that
    // blocks third-party CDNs) and no request for the engine files leaves this origin.
    workerPromise = createWorker('eng', 1, {
      workerPath: `${process.env.PUBLIC_URL}/tesseract/worker.min.js`,
      corePath: `${process.env.PUBLIC_URL}/tesseract/core`,
      langPath: `${process.env.PUBLIC_URL}/tesseract/lang`,
    });
  }
  return workerPromise;
}

/**
 * Runs OCR on a payslip photo/screenshot entirely in the browser — the image and
 * its contents never leave the device, and the OCR engine itself is served from
 * this app rather than a third-party CDN.
 */
export async function recognizePayslipImage(file: File): Promise<ParsedPayslip> {
  const worker = await getWorker();
  const { data } = await worker.recognize(file);
  return parsePayslipText(data.text);
}
