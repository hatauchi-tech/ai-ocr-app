import React from 'react';
import { DynamicOCRItem, OCRTemplate } from '../dynamicTypes';
import { generateColumnDefinitions, ColumnDefinition } from '../utils/schemaGenerator';
import { CheckCircle2, XCircle, AlertCircle, Check, Square } from 'lucide-react';

interface DynamicResultTableProps {
  items: DynamicOCRItem[];
  template: OCRTemplate;
  onItemUpdate?: (id: string, updates: Partial<DynamicOCRItem>) => void;
  compactMode?: boolean;
}

const DynamicResultTable: React.FC<DynamicResultTableProps> = ({
  items,
  template,
  onItemUpdate,
  compactMode = false
}) => {
  if (!items || items.length === 0) return null;

  const columns = generateColumnDefinitions(template);

  const handleDataChange = (itemId: string, field: string, value: any) => {
    if (!onItemUpdate) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newData = { ...item.data, [field]: value };
    onItemUpdate(itemId, { data: newData });
  };

  const toggleVerification = (itemId: string) => {
    if (!onItemUpdate) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    onItemUpdate(itemId, { isVerified: !item.isVerified });
  };

  const renderCellValue = (item: DynamicOCRItem, column: ColumnDefinition) => {
    const value = item.data[column.key];

    if (column.type === 'array') {
      if (!Array.isArray(value)) return '-';

      // 配列の表示（簡易版）
      if (value.length === 0) return '-';

      // オブジェクト配列の場合
      if (typeof value[0] === 'object') {
        return (
          <div className="flex flex-wrap gap-2">
            {value.map((obj, idx) => (
              <div key={idx} className="inline-flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden shadow-sm text-xs">
                {Object.entries(obj).map(([k, v]) => (
                  <span key={k} className="px-2 py-1 border-r border-slate-200 last:border-r-0">
                    <span className="text-[#5F6368] font-mono">{k}:</span>
                    <span className="ml-1 text-[#4285F4] font-medium">{String(v)}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        );
      }

      // プリミティブ配列の場合
      return value.join(', ');
    }

    if (column.type === 'boolean') {
      return value ? '✓' : '✗';
    }

    if (value === null || value === undefined) {
      return '-';
    }

    return String(value);
  };

  const renderEditableCell = (item: DynamicOCRItem, column: ColumnDefinition) => {
    const value = item.data[column.key];

    if (!column.editable) {
      return <span className="text-[#5F6368] text-sm">{renderCellValue(item, column)}</span>;
    }

    if (column.type === 'array') {
      // 配列は編集不可（簡易版）
      return <div className="text-sm">{renderCellValue(item, column)}</div>;
    }

    if (column.type === 'number') {
      return (
        <input
          type="number"
          className="w-full text-center bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#202124] font-medium transition-colors hover:border-slate-300 rounded-none text-sm"
          value={value ?? ''}
          onChange={(e) => handleDataChange(item.id, column.key, parseFloat(e.target.value) || 0)}
        />
      );
    }

    if (column.type === 'boolean') {
      return (
        <input
          type="checkbox"
          className="w-4 h-4"
          checked={value || false}
          onChange={(e) => handleDataChange(item.id, column.key, e.target.checked)}
        />
      );
    }

    // string型
    return (
      <input
        type="text"
        className="w-full bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#202124] transition-colors hover:border-slate-300 rounded-none text-sm"
        value={value ?? ''}
        onChange={(e) => handleDataChange(item.id, column.key, e.target.value)}
      />
    );
  };

  const totalRows = items.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stats */}
      {!compactMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-full text-[#4285F4]">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs text-[#5F6368] font-medium uppercase tracking-wide">読込件数</p>
              <p className="text-2xl font-google text-[#202124]">{totalRows}<span className="text-sm font-normal ml-1">件</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-green-50 rounded-full text-[#34A853]">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs text-[#5F6368] font-medium uppercase tracking-wide">テンプレート</p>
              <p className="text-lg font-google text-[#202124] truncate">{template.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${compactMode ? 'border-0 shadow-none rounded-none' : ''}`}>
        <div className="overflow-x-auto pb-20 sm:pb-0">
          <table className="w-full text-left text-sm text-[#202124]">
            <thead className="bg-[#F8F9FA] border-b border-slate-200 text-xs font-bold text-[#5F6368] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-4 w-12 text-center">Page</th>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-4 min-w-[120px]">
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-4 text-center sticky right-0 bg-[#F8F9FA] shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] z-20">
                    承認
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-[#F1F3F4]"
                >
                  <td className="px-4 py-3 text-center font-mono text-[#5F6368] text-xs whitespace-nowrap align-top">
                    {item.pageNumber || '-'}
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="px-2 py-2 align-top">
                      {renderEditableCell(item, col)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center sticky right-0 bg-white shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 whitespace-nowrap align-top pt-3">
                    <button
                      onClick={() => toggleVerification(item.id)}
                      className={`
                        flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mx-auto transition-all
                        ${item.isVerified
                          ? 'bg-[#34A853] text-white hover:bg-[#2D8E47]'
                          : 'bg-slate-200 text-[#5F6368] hover:bg-[#34A853] hover:text-white'}
                      `}
                    >
                      {item.isVerified ? (
                        <>
                          <Check size={14} /> 確認済
                        </>
                      ) : (
                        <>
                          <Square size={14} /> 承認
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!compactMode && (
          <div className="bg-[#F8F9FA] border-t border-slate-200 px-6 py-3 text-xs text-[#5F6368] flex justify-between">
            <span className="flex items-center gap-1">Powered by <span className="font-bold text-[#4285F4]">Gemini 3.0</span></span>
            <span>合計 {items.length} 行</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicResultTable;
