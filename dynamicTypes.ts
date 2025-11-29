// ==================== Generic OCR Schema Types ====================

export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface FieldDefinition {
  id: string;
  name: string; // フィールド名（英数字、JSONキー用）
  label: string; // 表示名（日本語可）
  type: FieldType;
  description: string; // Geminiへの抽出指示
  required: boolean;
  defaultValue?: any;
  // 配列の場合の子要素定義
  itemFields?: FieldDefinition[];
  // オブジェクトの場合のプロパティ定義
  properties?: FieldDefinition[];
  // 検証ルール
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    customRule?: string;
  };
}

export interface OCRTemplate {
  id: string;
  name: string;
  description: string;
  fields: FieldDefinition[];
  systemPrompt?: string; // カスタムシステムプロンプト
  createdAt: number;
  updatedAt: number;
}

export interface DynamicOCRItem {
  id: string;
  templateId: string;
  sourceFile?: string;
  sourceImageUrl?: string;
  jobId?: string;
  pageNumber?: number;
  boundingBox?: number[];
  isVerified: boolean;
  // 動的フィールド（ユーザー定義）
  data: Record<string, any>;
}

export interface DynamicOCRResult {
  items: DynamicOCRItem[];
}

// ==================== Legacy Types (Backward Compatibility) ====================

export interface Distribution {
  shopCode: string;
  quantity: number;
}

export interface OCRItem {
  id: string;
  no: string;
  janCode: string;
  productName: string;
  vendorProductCode: string;
  size: string;
  color: string;
  reportedTotal: number;
  distributions: Distribution[];
  calculatedTotal: number;
  isCorrect: boolean;
  isVerified: boolean;
  sourceFile?: string;
  sourceImageUrl?: string;
  jobId?: string;
  pageNumber?: number;
  boundingBox?: number[];
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
  templateId?: string; // 使用するテンプレートID
}

// ==================== Default Templates ====================

// デフォルトテンプレートなし（ユーザーが自由に作成）
export const DEFAULT_TEMPLATES: OCRTemplate[] = [];
