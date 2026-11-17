export type OcrLine = {
  text: string;
  /** Score from 0 to 100; Gemini supplies a subjective estimate, not a calibrated probability. */
  confidencePercentage: number | null;
  confidenceSource?: "model_estimate" | "provider";
  boundingBox?: [number, number][];
  boxHeight?: number;
};

export type OcrResponse = {
  text: string;
  model: string;
  lines: OcrLine[];
  expenses?: ExpenseCandidate[];
  adjustments?: {tax:number|null;discount:number|null;currency:string|null};
};

export type ExpenseCandidate={title:string;cost:number|null;sourceLineIndexes:number[]};

export type ReceiptResponse = {
  ocr: OcrResponse;
  fields: {
    vendor: string | null;
    date: string | null;
    total: number | null;
  };
  needsReview: true;
  expenses: ExpenseCandidate[];
  adjustments: {tax:number|null;discount:number|null;currency:string|null};
};
