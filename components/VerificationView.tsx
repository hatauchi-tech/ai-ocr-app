import React, { useState, useEffect, useRef } from 'react';
import { OCRItem, ProcessingJob } from '../types';
import ResultTable from './ResultTable';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize, CheckCircle2, AlertCircle, Download, RefreshCw } from 'lucide-react';

interface VerificationViewProps {
  job: ProcessingJob;
  items: OCRItem[];
  onBack: () => void;
  onItemUpdate: (id: string, updates: Partial<OCRItem>) => void;
  onExportCSV?: () => void;
  onReprocessPage?: (pageNumber: number) => void;
}

const VerificationView: React.FC<VerificationViewProps> = ({ job, items, onBack, onItemUpdate, onExportCSV, onReprocessPage }) => {
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [sourceImageDimensions, setSourceImageDimensions] = useState<{width: number, height: number} | null>(null);
  
  // Viewport State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [currentPageNumber, setCurrentPageNumber] = useState<number | null>(null);

  // Split View Resizing State
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeImageUrl && items.length > 0 && items[0].sourceImageUrl) {
      setActiveImageUrl(items[0].sourceImageUrl);
      setCurrentPageNumber(items[0].pageNumber || 1);
    }
  }, [items, activeImageUrl]);

  // Reset dimensions when image changes
  useEffect(() => {
    setSourceImageDimensions(null);
  }, [activeImageUrl]);

  const handleRowClick = (item: OCRItem, index: number) => {
    setSelectedRowIndex(index);
    if (item.sourceImageUrl && item.sourceImageUrl !== activeImageUrl) {
      setActiveImageUrl(item.sourceImageUrl);
    }
    if (item.pageNumber) {
        setCurrentPageNumber(item.pageNumber);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setSourceImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleReprocessClick = () => {
      if (currentPageNumber && onReprocessPage) {
          if (confirm(`ページ ${currentPageNumber} を再スキャンしますか？\nこのページの既存データは上書きされます。`)) {
              onReprocessPage(currentPageNumber);
          }
      }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input field, only allow Esc
      const isInputActive = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur();
        return;
      }

      if (isInputActive) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRowIndex(prev => {
          if (prev === null) return 0;
          const nextIndex = Math.min(prev + 1, items.length - 1);
          // Update current page for reprocess button context
          if (items[nextIndex]?.pageNumber) setCurrentPageNumber(items[nextIndex].pageNumber!);
          return nextIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRowIndex(prev => {
          if (prev === null) return 0;
          const nextIndex = Math.max(prev - 1, 0);
          if (items[nextIndex]?.pageNumber) setCurrentPageNumber(items[nextIndex].pageNumber!);
          return nextIndex;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedRowIndex !== null) {
          const item = items[selectedRowIndex];
          onItemUpdate(item.id, { isVerified: !item.isVerified });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedRowIndex, onItemUpdate]);

  // Auto-Pan to Selected Item
  useEffect(() => {
    if (selectedRowIndex === null || !items[selectedRowIndex] || !containerRef.current || !sourceImageDimensions) return;

    const item = items[selectedRowIndex];
    
    // Ensure we are looking at the right image
    if (item.sourceImageUrl !== activeImageUrl) {
        return;
    }

    if (item.boundingBox) {
      const [ymin, xmin, ymax, xmax] = item.boundingBox;
      
      // Center of the bbox (0-1000 scale)
      const centerX = (xmin + xmax) / 2;
      const centerY = (ymin + ymax) / 2;

      // Container dimensions
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;

      // Image original size
      const { width: imgW, height: imgH } = sourceImageDimensions;

      // Calculate the pixel position of the bbox center relative to the unscaled image
      const targetX = (centerX / 1000) * imgW;
      const targetY = (centerY / 1000) * imgH;

      const offsetX = targetX - (imgW / 2);
      const offsetY = targetY - (imgH / 2);

      const newPanX = -offsetX * zoomLevel;
      const newPanY = -offsetY * zoomLevel;

      setPan({ x: newPanX, y: newPanY });
    }
  }, [selectedRowIndex, sourceImageDimensions, zoomLevel, items, activeImageUrl]);


  // Zoom Controls
  const adjustZoom = (delta: number) => setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.1), 5));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse Interactions for Image
  const handleWheel = (e: React.WheelEvent) => {
    adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
  };

  const handleMouseDownImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMoveImage = (e: React.MouseEvent) => {
    if (!isDraggingImage) return;
    e.preventDefault();
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUpImage = () => setIsDraggingImage(false);

  // Resizer Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Highlight Logic
  const selectedItem = selectedRowIndex !== null ? items[selectedRowIndex] : null;
  const showHighlight = selectedItem && selectedItem.sourceImageUrl === activeImageUrl && selectedItem.boundingBox;

  // Bounding Box Style Calculation
  const getBoundingBoxStyle = (bbox: number[]) => {
    // bbox is [ymin, xmin, ymax, xmax] normalized to 0-1000
    const [ymin, xmin, ymax, xmax] = bbox;
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
    };
  };

  return (
    <div className={`fixed inset-0 bg-[#F8F9FA] z-50 flex flex-col ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* Header */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-[#5F6368] transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
              {job.file.name}
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${job.status === 'completed' ? 'bg-green-50 text-[#34A853] border-green-100' : 'bg-blue-50 text-[#4285F4] border-blue-100'}`}>
                {job.status === 'completed' ? '完了' : '処理中'}
              </span>
            </h2>
            <p className="text-xs text-[#5F6368] flex items-center gap-2">
              照合モード • {items.length} 件抽出
              {currentPageNumber && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[#202124] font-mono">
                      P.{currentPageNumber} 表示中
                  </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            {currentPageNumber && onReprocessPage && (
                <button 
                    onClick={handleReprocessClick}
                    className="flex items-center gap-1 text-xs font-medium text-[#5F6368] hover:text-[#202124] bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
                    title="現在のページを再スキャン"
                >
                    <RefreshCw size={14} /> P.{currentPageNumber} 再スキャン
                </button>
            )}

            <div className="hidden lg:flex text-xs text-[#5F6368] bg-slate-100 px-3 py-1.5 rounded-lg gap-4">
              <span className="flex items-center gap-1"><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-sans">↑</kbd> <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-sans">↓</kbd> 移動</span>
              <span className="flex items-center gap-1"><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-sans">Enter</kbd> 承認</span>
              <span className="flex items-center gap-1"><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-sans">Esc</kbd> 編集終了</span>
            </div>
            <button onClick={onExportCSV} className="flex items-center gap-2 px-5 py-2 bg-[#4285F4] hover:bg-[#3367D6] text-white text-sm font-bold rounded-full shadow-sm transition-colors">
                <Download size={16} /> CSV出力
            </button>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT: Image Viewer */}
        <div 
            ref={containerRef}
            className="bg-[#202124] relative flex flex-col border-r border-slate-700" 
            style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#303134]/90 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg border border-[#5F6368] z-20">
            <button onClick={() => adjustZoom(-0.25)} className="p-1.5 text-slate-300 hover:text-white hover:bg-[#5F6368] rounded-full"><ZoomOut size={18} /></button>
            <span className="text-xs text-slate-300 w-12 text-center font-mono">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => adjustZoom(0.25)} className="p-1.5 text-slate-300 hover:text-white hover:bg-[#5F6368] rounded-full"><ZoomIn size={18} /></button>
            <div className="w-px h-4 bg-slate-600 mx-1"></div>
            <button onClick={handleResetZoom} className="p-1.5 text-slate-300 hover:text-white hover:bg-[#5F6368] rounded-full"><Maximize size={18} /></button>
          </div>

          <div 
            className={`flex-1 overflow-hidden flex items-center justify-center relative ${isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDownImage}
            onMouseMove={handleMouseMoveImage}
            onMouseUp={handleMouseUpImage}
            onMouseLeave={handleMouseUpImage}
            onWheel={handleWheel}
          >
            <div style={{ 
                  position: 'relative',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center',
                  transition: isDraggingImage ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  display: 'inline-block', 
                  lineHeight: 0,           
                  fontSize: 0,
                  margin: 0,
                  padding: 0,
                  verticalAlign: 'top'
               }}
            >
                {activeImageUrl ? (
                  <>
                    <img 
                      ref={imageRef}
                      src={activeImageUrl} 
                      alt="Source" 
                      className="shadow-2xl"
                      onLoad={handleImageLoad}
                      draggable={false}
                      style={{ 
                        display: 'block', 
                        maxWidth: '90vw', 
                        maxHeight: '90vh', 
                        margin: 0,
                        padding: 0,
                        verticalAlign: 'top',
                        pointerEvents: 'none' 
                      }}
                    />
                    {showHighlight && selectedItem.boundingBox && (
                      <div 
                        className="animate-pulse"
                        style={{
                          position: 'absolute',
                          ...getBoundingBoxStyle(selectedItem.boundingBox),
                          border: '3px solid #FF6D00', // Orange high contrast
                          backgroundColor: 'rgba(255, 109, 0, 0.1)',
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.3) inset, 0 0 8px rgba(0,0,0,0.5)', 
                          zIndex: 10,
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div className="text-[#9AA0A6] flex flex-col items-center scale-100">
                    <AlertCircle className="mb-2" size={32} />
                    <p className="text-sm">画像が選択されていません</p>
                  </div>
                )}
            </div>
          </div>
          <div className="absolute bottom-4 left-4 text-[10px] text-[#9AA0A6] bg-[#303134]/80 px-2 py-1 rounded pointer-events-none z-20">
            スクロール: 拡大縮小 • ドラッグ: 移動
          </div>
        </div>

        {/* RESIZER */}
        <div 
            className={`w-4 bg-[#F1F3F4] border-l border-r border-slate-200 flex items-center justify-center cursor-col-resize hover:bg-blue-50 hover:border-blue-200 transition-colors group z-10 relative ${isResizing ? 'bg-blue-100 border-blue-300' : ''}`}
            onMouseDown={() => setIsResizing(true)}
        >
            <div className={`h-8 w-1 rounded-full bg-slate-300 group-hover:bg-[#4285F4] transition-colors ${isResizing ? 'bg-[#4285F4]' : ''}`}/>
        </div>

        {/* RIGHT: Data Table */}
        <div className="bg-white overflow-y-auto flex flex-col" style={{ width: `${100 - leftPanelWidth}%` }}>
           <div className="sticky top-0 bg-[#F8F9FA] px-5 py-3 border-b border-slate-200 text-xs font-medium text-[#5F6368] flex justify-between items-center z-10">
               <span className="font-bold text-[#202124]">抽出結果</span>
               <div className="flex gap-3">
                   <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-[#34A853]"/> 一致</span>
                   <span className="flex items-center gap-1"><AlertCircle size={14} className="text-[#EA4335]"/> 不一致</span>
               </div>
           </div>
           <div className="p-4">
               <ResultTable items={items} compactMode={true} selectedRowIndex={selectedRowIndex} onRowClick={handleRowClick} onItemUpdate={onItemUpdate} />
           </div>
        </div>
        {isResizing && <div className="absolute inset-0 z-50 cursor-col-resize" />}
      </div>
    </div>
  );
};

export default VerificationView;