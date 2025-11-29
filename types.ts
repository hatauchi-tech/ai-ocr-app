export interface Distribution {
  shopCode: string;
  quantity: number;
}

export interface OCRItem {
  id: string;
  no: string;
  janCode: string;
  productName: string;
  vendorProductCode: string; // 取引先品番
  size: string;
  color: string;
  reportedTotal: number; // 帳票総数
  distributions: Distribution[];
  calculatedTotal: number; // 計算総数
  isCorrect: boolean; // 判定
  isVerified: boolean; // 手動確認済みフラグ
  sourceFile?: string; // Track which file this came from
  sourceImageUrl?: string; // Blob URL to the specific page image
  jobId?: string; // Unique Job ID for filtering
  pageNumber?: number; // ページ番号
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
}

export interface OCRResult {
  items: OCRItem[];
}

export interface ProcessingJob {
  id: string;
  file: File;
  status: 'queued' | 'converting' | 'processing' | 'completed' | 'error';
  totalPages: number;
  processedPages: number;
  progressMessage: string;
  errorMessage?: string;
  addedAt: number;
}