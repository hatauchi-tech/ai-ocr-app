import { DynamicOCRItem, OCRTemplate } from '../dynamicTypes';

/**
 * 動的テンプレートに基づいてCSVをエクスポート
 */
export const exportDynamicToCSV = (
  items: DynamicOCRItem[],
  template: OCRTemplate,
  filenamePrefix: string = 'ocr_export'
) => {
  if (!items || items.length === 0) return;

  // ヘッダーを生成
  const headers = ['ページ', ...template.fields.map(f => f.label), '確認済み'];

  const csvRows = [headers.join(",")];

  items.forEach(item => {
    const escape = (str: string | undefined) => `"${(str || '').replace(/"/g, '""')}"`;

    const row = [
      item.pageNumber || '',
      ...template.fields.map(field => {
        const value = item.data[field.name];
        return formatCsvValue(value, field.type);
      }),
      item.isVerified ? 'はい' : 'いいえ'
    ];

    csvRows.push(row.join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().getTime();

  link.href = url;
  link.download = `${filenamePrefix}_${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * 値をCSV形式にフォーマット
 */
function formatCsvValue(value: any, type: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (type === 'array') {
    if (!Array.isArray(value)) return '';

    // オブジェクト配列の場合はJSON文字列化
    if (value.length > 0 && typeof value[0] === 'object') {
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    }

    // プリミティブ配列は , 区切り
    return `"${value.join(', ')}"`;
  }

  if (type === 'object') {
    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }

  if (type === 'boolean') {
    return value ? 'はい' : 'いいえ';
  }

  // 文字列の場合はエスケープ
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}
