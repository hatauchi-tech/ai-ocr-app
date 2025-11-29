import React from 'react';
import { X } from 'lucide-react';

interface ImagePreviewModalProps {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, title, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10">
          <div>
             <h3 className="text-lg font-bold text-[#202124]">元画像プレビュー</h3>
             <p className="text-sm text-[#5F6368]">{title}</p>
          </div>
          <div className="flex items-center gap-2">
             <button 
               onClick={onClose}
               className="p-2 hover:bg-[#F1F3F4] rounded-full text-[#5F6368] hover:text-[#202124] transition-colors"
             >
               <X size={24} />
             </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-auto bg-[#F8F9FA] p-4 flex items-start justify-center relative">
           <img 
             src={imageUrl} 
             alt="Source Document" 
             className="max-w-full h-auto shadow-md border border-slate-200"
             style={{ maxHeight: 'none' }} // Allow scrolling if image is long
           />
        </div>

        {/* Footer Tips */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-[#5F6368] flex justify-between">
           <span>ページ全体を見るにはスクロールしてください</span>
           <span>ESCキーで閉じる</span>
        </div>
      </div>
      
      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
};

export default ImagePreviewModal;