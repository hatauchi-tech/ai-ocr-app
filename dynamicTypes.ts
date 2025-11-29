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

export const HOKKAIDO_SANKI_TEMPLATE: OCRTemplate = {
  id: 'hokkaido-sanki-fax-v1',
  name: '北海道三喜社 FAX注文書',
  description: '配送ピッキングリスト専用テンプレート',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  systemPrompt: `あなたは「北海道三喜社」のFAX注文書（配送ピッキングリスト）処理に特化した専門AIです。
添付の画像を読み取り、以下の[処理ルール]に従ってデータを構造化し、JSONのみを出力してください。

## データ抽出・クリーニングルール
画像内の表構造（特に3列目・4列目）を詳細に解釈してください。

**注意:** 表のヘッダー行（項目名）は抽出しないでください。具体的な商品データ（No.1〜）のみを抽出対象としてください。`,
  fields: [
    {
      id: 'no',
      name: 'no',
      label: 'No',
      type: 'string',
      description: '行番号',
      required: true
    },
    {
      id: 'janCode',
      name: 'janCode',
      label: 'JANコード',
      type: 'string',
      description: 'JAN Code',
      required: false
    },
    {
      id: 'productName',
      name: 'productName',
      label: '商品名',
      type: 'string',
      description: '3列目「商品名/品番」の上段のテキストのみを抽出。下段の数値は無視。',
      required: true
    },
    {
      id: 'vendorProductCode',
      name: 'vendorProductCode',
      label: 'メーカー品番',
      type: 'string',
      description: '4列目の上段にある英数字（例: E90604）。スペース区切りの場合は最後の部分を採用。',
      required: false
    },
    {
      id: 'size',
      name: 'size',
      label: 'サイズ',
      type: 'string',
      description: '4列目下段・左側の数値。縦罫線が「1」と誤認識される場合（1150 -> 150）は補正。',
      required: false
    },
    {
      id: 'color',
      name: 'color',
      label: 'カラー',
      type: 'string',
      description: '4列目下段・右側の色名。',
      required: false
    },
    {
      id: 'reportedTotal',
      name: 'reportedTotal',
      label: '帳票総数',
      type: 'number',
      description: '「イリソウ（入数/総数）」列の下段の数値。',
      required: true
    },
    {
      id: 'distributions',
      name: 'distributions',
      label: '配送内訳',
      type: 'array',
      description: '右側の「店コード」と「数量」のペア配列。',
      required: true,
      itemFields: [
        {
          id: 'shopCode',
          name: 'shopCode',
          label: '店コード',
          type: 'string',
          description: '店舗コード',
          required: true
        },
        {
          id: 'quantity',
          name: 'quantity',
          label: '数量',
          type: 'number',
          description: '配送数量',
          required: true
        }
      ]
    },
    {
      id: 'boundingBox',
      name: 'boundingBox',
      label: '位置情報',
      type: 'array',
      description: '[ymin, xmin, ymax, xmax] (0-1000 scale)。実際の破線（行区切り線）を目視して正確なY座標範囲を取得。',
      required: true
    }
  ]
};

export const GENERIC_INVOICE_TEMPLATE: OCRTemplate = {
  id: 'generic-invoice-v1',
  name: '汎用請求書',
  description: '一般的な請求書フォーマット',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  fields: [
    {
      id: 'invoiceNumber',
      name: 'invoiceNumber',
      label: '請求書番号',
      type: 'string',
      description: '請求書番号またはID',
      required: true
    },
    {
      id: 'date',
      name: 'date',
      label: '日付',
      type: 'string',
      description: '請求日付（YYYY-MM-DD形式）',
      required: true
    },
    {
      id: 'customerName',
      name: 'customerName',
      label: '顧客名',
      type: 'string',
      description: '請求先の顧客名または会社名',
      required: true
    },
    {
      id: 'items',
      name: 'items',
      label: '明細',
      type: 'array',
      description: '請求明細の配列',
      required: true,
      itemFields: [
        {
          id: 'description',
          name: 'description',
          label: '品目',
          type: 'string',
          description: '商品またはサービスの説明',
          required: true
        },
        {
          id: 'quantity',
          name: 'quantity',
          label: '数量',
          type: 'number',
          description: '数量',
          required: true
        },
        {
          id: 'unitPrice',
          name: 'unitPrice',
          label: '単価',
          type: 'number',
          description: '単価',
          required: true
        },
        {
          id: 'amount',
          name: 'amount',
          label: '金額',
          type: 'number',
          description: '合計金額（数量 × 単価）',
          required: true
        }
      ]
    },
    {
      id: 'subtotal',
      name: 'subtotal',
      label: '小計',
      type: 'number',
      description: '税抜き合計金額',
      required: true
    },
    {
      id: 'tax',
      name: 'tax',
      label: '消費税',
      type: 'number',
      description: '消費税額',
      required: false
    },
    {
      id: 'total',
      name: 'total',
      label: '合計',
      type: 'number',
      description: '税込み合計金額',
      required: true
    }
  ]
};

export const DEFAULT_TEMPLATES: OCRTemplate[] = [
  HOKKAIDO_SANKI_TEMPLATE,
  GENERIC_INVOICE_TEMPLATE
];
