import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { OCRItem } from '../types';
import { CheckCircle2, XCircle, AlertCircle, Eye, Check, Square } from 'lucide-react';

interface ResultTableProps {
  items: OCRItem[];
  onViewSource?: (url: string, title: string) => void;
  compactMode?: boolean;
  onRowClick?: (item: OCRItem, index: number) => void;
  selectedRowIndex?: number | null;
  onItemUpdate?: (id: string, updates: Partial<OCRItem>) => void;
}

const AutoResizeTextarea = ({ value, onChange, className, placeholder }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`${className} resize-none overflow-hidden block`}
      style={{ minHeight: '28px' }}
    />
  );
};

const ResultTable: React.FC<ResultTableProps> = ({ 
  items, 
  onViewSource, 
  compactMode = false,
  onRowClick,
  selectedRowIndex,
  onItemUpdate
}) => {
  // Auto-scroll to selected row
  useEffect(() => {
    if (selectedRowIndex !== null && selectedRowIndex !== undefined) {
      const rowElement = document.getElementById(`ocr-row-${selectedRowIndex}`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedRowIndex]);

  if (!items || items.length === 0) return null;

  const totalRows = items.length;
  const okCount = items.filter(i => i.isCorrect).length;
  const errorCount = totalRows - okCount;

  const showStats = !compactMode;

  const handleInputChange = (id: string, field: keyof OCRItem, value: string | number) => {
    if (onItemUpdate) {
      onItemUpdate(id, { [field]: value });
    }
  };

  const handleDistributionChange = (id: string, item: OCRItem, distIndex: number, newQty: number) => {
    if (onItemUpdate) {
      const newDistributions = [...item.distributions];
      newDistributions[distIndex] = { ...newDistributions[distIndex], quantity: newQty };
      onItemUpdate(id, { distributions: newDistributions });
    }
  };

  const toggleVerification = (e: React.MouseEvent, item: OCRItem) => {
    e.stopPropagation();
    if (onItemUpdate) {
        onItemUpdate(item.id, { isVerified: !item.isVerified });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stats Cards - Google Style */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-full text-[#4285F4]">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs text-[#5F6368] font-medium uppercase tracking-wide">読込行数</p>
              <p className="text-2xl font-google text-[#202124]">{totalRows}<span className="text-sm font-normal ml-1">件</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-green-50 rounded-full text-[#34A853]">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs text-[#5F6368] font-medium uppercase tracking-wide">数量一致</p>
              <p className="text-2xl font-google text-[#34A853]">{okCount}<span className="text-sm font-normal text-[#202124] ml-1">件</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-red-50 rounded-full text-[#EA4335]">
              <XCircle size={24} />
            </div>
            <div>
              <p className="text-xs text-[#5F6368] font-medium uppercase tracking-wide">不一致・要確認</p>
              <p className="text-2xl font-google text-[#EA4335]">{errorCount}<span className="text-sm font-normal text-[#202124] ml-1">件</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${compactMode ? 'border-0 shadow-none rounded-none' : ''}`}>
        <div className="overflow-x-auto pb-20 sm:pb-0">
          <table className="w-full text-left text-sm text-[#202124]">
            <thead className="bg-[#F8F9FA] border-b border-slate-200 text-xs font-bold text-[#5F6368] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-4 w-12 text-center whitespace-nowrap">Page</th>
                <th className="px-4 py-4 w-16 text-center">No</th>
                {!compactMode && <th className="px-4 py-4 w-12 text-center">画像</th>}
                <th className="px-4 py-4 min-w-[260px]">商品名</th>
                <th className="px-4 py-4 min-w-[130px]">JANコード</th>
                <th className="px-4 py-4 min-w-[140px]">メーカー品番</th>
                <th className="px-4 py-4 min-w-[100px]">サイズ</th>
                <th className="px-4 py-4 min-w-[120px]">カラー</th>
                <th className="px-4 py-4 text-center bg-slate-100/50 border-l border-slate-100">記載合計</th>
                <th className="px-4 py-4 min-w-[300px]">店別配分 (店:数量)</th>
                <th className="px-4 py-4 text-center bg-slate-100/50 border-r border-slate-100">算出合計</th>
                <th className="px-4 py-4 text-center sticky right-0 bg-[#F8F9FA] shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] z-20">承認</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const isSelected = selectedRowIndex === idx;
                const isStatusOk = item.isCorrect;
                const needsCheck = !isStatusOk && !item.isVerified;
                const isVerifiedNG = !isStatusOk && item.isVerified;

                return (
                  <tr 
                    key={item.id}
                    id={`ocr-row-${idx}`}
                    onClick={() => onRowClick && onRowClick(item, idx)}
                    className={`
                      transition-colors group
                      ${isSelected ? 'bg-blue-50/60' : 'hover:bg-[#F1F3F4]'}
                      ${needsCheck && !isSelected ? 'bg-red-50/30' : ''}
                      ${isVerifiedNG && !isSelected ? 'bg-yellow-50/30' : ''}
                    `}
                  >
                    <td className="px-4 py-3 text-center font-mono text-[#5F6368] text-xs whitespace-nowrap align-top pt-3.5">{item.pageNumber || '-'}</td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text"
                        className="w-full text-center bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#5F6368] font-mono text-sm transition-colors hover:border-slate-300 rounded-none"
                        value={item.no}
                        onChange={(e) => handleInputChange(item.id, 'no', e.target.value)}
                      />
                    </td>
                    {!compactMode && (
                      <td className="px-4 py-3 text-center whitespace-nowrap align-top pt-3">
                        {item.sourceImageUrl && onViewSource ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onViewSource(item.sourceImageUrl!, `${item.sourceFile} - P${item.pageNumber}`); }}
                            className="p-1.5 text-slate-400 hover:text-[#4285F4] hover:bg-blue-50 rounded-full transition-colors"
                          >
                            <Eye size={18} />
                          </button>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    )}

                    {/* Editable Columns with Auto-Resize Textarea */}
                    <td className="px-2 py-2 align-top">
                       <AutoResizeTextarea 
                         className="w-full bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#202124] font-medium transition-colors hover:border-slate-300 rounded-none leading-relaxed"
                         value={item.productName || ''}
                         onChange={(e) => handleInputChange(item.id, 'productName', e.target.value)}
                         placeholder="商品名を入力"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text"
                        className="w-full bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#5F6368] font-mono text-xs transition-colors hover:border-slate-300 rounded-none"
                        value={item.janCode || ''}
                        onChange={(e) => handleInputChange(item.id, 'janCode', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                       <AutoResizeTextarea 
                         className="w-full bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#5F6368] font-mono text-xs transition-colors hover:border-slate-300 rounded-none"
                         value={item.vendorProductCode || ''}
                         onChange={(e) => handleInputChange(item.id, 'vendorProductCode', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <AutoResizeTextarea 
                         className="w-full bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#202124] text-sm transition-colors hover:border-slate-300 rounded-none"
                         value={item.size || ''}
                         onChange={(e) => handleInputChange(item.id, 'size', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <AutoResizeTextarea 
                         className="w-full bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#202124] text-sm transition-colors hover:border-slate-300 rounded-none"
                         value={item.color || ''}
                         onChange={(e) => handleInputChange(item.id, 'color', e.target.value)}
                      />
                    </td>

                    {/* Reported Total */}
                    <td className="px-2 py-2 bg-slate-50/30 border-l border-slate-100 whitespace-nowrap align-top">
                       <input 
                         type="number"
                         className="w-16 text-center bg-transparent border-b border-transparent focus:border-[#4285F4] focus:ring-0 p-1 text-[#202124] font-bold transition-colors hover:border-slate-300 rounded-none"
                         value={item.reportedTotal}
                         onChange={(e) => handleInputChange(item.id, 'reportedTotal', parseInt(e.target.value) || 0)}
                      />
                    </td>

                    {/* Distributions */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {item.distributions.map((d, i) => (
                          <div key={i} className="inline-flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden shadow-sm text-xs group-focus:border-blue-200">
                            <span className="px-2 py-1 bg-slate-50 text-[#5F6368] border-r border-slate-200 font-mono select-none">
                              {d.shopCode}
                            </span>
                            <input 
                                type="number"
                                className="w-12 py-1 px-1 text-center font-medium text-[#4285F4] border-0 focus:ring-0 p-0 text-xs"
                                value={d.quantity}
                                onChange={(e) => handleDistributionChange(item.id, item, i, parseInt(e.target.value) || 0)}
                            />
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Calculated Total */}
                    <td className={`px-4 py-3 text-center font-bold bg-slate-50/30 border-r border-slate-100 whitespace-nowrap align-top pt-3.5 ${isStatusOk ? 'text-[#202124]' : 'text-[#EA4335]'}`}>
                      {item.calculatedTotal}
                    </td>

                    {/* Status & Action */}
                    <td className="px-4 py-3 text-center sticky right-0 bg-white shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 whitespace-nowrap align-top pt-3 group-hover:bg-[#F1F3F4]">
                      <div className="flex flex-col items-center gap-1">
                        {isStatusOk ? (
                           <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-[#34A853] text-xs font-bold">
                             <Check size={12} strokeWidth={3} /> OK
                           </span>
                        ) : (
                           <button 
                             onClick={(e) => toggleVerification(e, item)}
                             className={`
                               flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow-sm transition-all
                               ${item.isVerified 
                                  ? 'bg-[#FEF7E0] text-[#B06000] hover:bg-[#FEEFC3] border border-[#FEEFC3]' 
                                  : 'bg-[#EA4335] text-white hover:shadow-md hover:bg-[#D93025]'}
                             `}
                           >
                             {item.isVerified ? (
                               <>
                                 <CheckCircle2 size={14} /> 確認済
                               </>
                             ) : (
                               <>
                                 <Square size={14} /> 承認
                               </>
                             )}
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

export default ResultTable;