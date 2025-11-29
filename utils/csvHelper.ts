import { OCRItem } from '../types';

export const exportToCSV = (items: OCRItem[], filenamePrefix: string = 'hokkaido_sanki_ocr') => {
  if (!items || items.length === 0) return;

  const headers = [
    "ページ", "No", "商品名", "JANコード", "メーカー品番", 
    "サイズ", "カラー", "記載合計", "店番号", "数量", "算出合計", "確認"
  ];

  const csvRows = [headers.join(",")];

  items.forEach(item => {
    // Escape quotes for CSV format
    const escape = (str: string | undefined) => `"${(str || '').replace(/"/g, '""')}"`;

    const baseRow = [
      item.pageNumber || '',
      item.no,
      escape(item.productName),
      escape(item.janCode),
      escape(item.vendorProductCode),
      escape(item.size),
      escape(item.color),
      item.reportedTotal
    ];

    if (item.distributions && item.distributions.length > 0) {
      item.distributions.forEach(dist => {
        const row = [
          ...baseRow,
          `"${dist.shopCode}"`,
          dist.quantity,
          item.calculatedTotal,
          item.isCorrect ? "OK" : "確認要"
        ];
        csvRows.push(row.join(","));
      });
    } else {
      // If no distributions, just output the base item info with empty distribution fields
      const row = [
        ...baseRow,
        "",
        "",
        item.calculatedTotal,
        item.isCorrect ? "OK" : "確認要"
      ];
      csvRows.push(row.join(","));
    }
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