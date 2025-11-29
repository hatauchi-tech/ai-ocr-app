import React, { useRef, useState } from 'react';
import { Upload, CloudUpload } from 'lucide-react';

interface DropzoneProps {
  onFileSelect: (files: File[]) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files) as File[];
      const validFiles = fileList.filter(file => 
        file.type === 'application/pdf' || 
        file.type.startsWith('image/')
      );
      if (validFiles.length > 0) {
        onFileSelect(validFiles);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      onFileSelect(fileList);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div 
      className={`
        relative group cursor-pointer
        w-full h-48 rounded-3xl border-2 border-dashed transition-all duration-300 ease-in-out
        flex flex-col items-center justify-center text-center p-6 overflow-hidden
        ${isDragging 
          ? 'border-[#4285F4] bg-blue-50' 
          : 'border-slate-300 bg-white hover:border-[#4285F4] hover:bg-blue-50/30 shadow-sm hover:shadow-md'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept="image/png, image/jpeg, image/webp, application/pdf"
        onChange={handleFileInput}
      />

      <div className="flex flex-col items-center space-y-4">
        <div className={`p-4 rounded-full bg-blue-50 text-[#4285F4] transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
          <CloudUpload size={32} />
        </div>
        <div>
          <p className="text-lg font-medium text-[#202124] flex items-center justify-center gap-2">
            FAX注文書をここにドロップ
          </p>
          <p className="text-sm mt-1 text-[#5F6368]">
            または <span className="text-[#4285F4] font-medium hover:underline">ファイルを選択</span>
          </p>
          <p className="text-xs mt-2 text-[#5F6368] bg-slate-100 inline-block px-3 py-1 rounded-full">
             PDF, JPG, PNG 対応 (FAX画質対応)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dropzone;