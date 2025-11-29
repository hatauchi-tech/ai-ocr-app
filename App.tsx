import React, { useState, useCallback, useEffect, useRef } from 'react';
import { OCRItem, ProcessingJob } from './types';
import { processPickingList } from './services/geminiService';
import { convertPdfToImages } from './services/pdfService';
import { storageService } from './services/storageService';
import { exportToCSV } from './utils/csvHelper';
import Dropzone from './components/Dropzone';
import ResultTable from './components/ResultTable';
import JobStatus from './components/JobStatus';
import ImagePreviewModal from './components/ImagePreviewModal';
import VerificationView from './components/VerificationView';
import { ScanLine, Box, FileSpreadsheet, Sparkles, Trash2, Download } from 'lucide-react';

const App: React.FC = () => {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [resultItems, setResultItems] = useState<OCRItem[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  
  // View State
  const [currentView, setCurrentView] = useState<'dashboard' | 'verification'>('dashboard');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Legacy Preview State (for dashboard)
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  // Use ref to track items for cleanup on unmount
  const itemsRef = useRef<OCRItem[]>([]);

  useEffect(() => {
    itemsRef.current = resultItems;
  }, [resultItems]);

  // --- Persistence & Restoration ---

  useEffect(() => {
    const restoreData = async () => {
      try {
        const { jobs: restoredJobs, items: restoredItems } = await storageService.loadAllData();
        if (restoredJobs.length > 0) setJobs(restoredJobs);
        if (restoredItems.length > 0) setResultItems(restoredItems);
      } catch (error) {
        console.error("Failed to restore data:", error);
      } finally {
        setIsRestoring(false);
      }
    };
    restoreData();
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach(item => {
        if (item.sourceImageUrl) URL.revokeObjectURL(item.sourceImageUrl);
      });
    };
  }, []);

  // --- Job Processing Logic ---

  const addFilesToQueue = useCallback((files: File[]) => {
    const newJobs: ProcessingJob[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'queued',
      totalPages: 0,
      processedPages: 0,
      progressMessage: '待機中...',
      addedAt: Date.now(),
    }));

    // Save initial job state
    newJobs.forEach(job => storageService.saveJob(job));
    setJobs(prev => [...prev, ...newJobs]);
    
    // Process all new jobs
    // They will be managed by the internal concurrency limit in geminiService (p-limit)
    // and PDF worker concurrency (browser thread handling)
    newJobs.forEach(job => processJob(job));
  }, []);

  const processJob = async (job: ProcessingJob) => {
    const updateStatus = (updates: Partial<ProcessingJob>) => updateJob(job.id, updates);

    try {
      updateStatus({ status: 'converting', progressMessage: 'ファイルを準備中...' });

      // 1. Convert PDF if necessary
      let filesToProcess: File[] = [];
      
      const firstPageBlob = await storageService.getPageImage(job.id, 0);
      
      if (firstPageBlob) {
          // Restore from DB if available (retry scenario)
          const storedPages = [];
          let pageIdx = 0;
          while(true) {
              const blob = await storageService.getPageImage(job.id, pageIdx);
              if (!blob) break;
              const file = new File([blob], `${job.file.name}_p${pageIdx}.jpg`, { type: 'image/jpeg' });
              storedPages.push(file);
              pageIdx++;
          }
          filesToProcess = storedPages;
      } else {
          // Fresh processing (Use Worker for PDF)
          if (job.file.type === 'application/pdf') {
            updateStatus({ status: 'converting', progressMessage: 'PDFを画像に変換中...' });
            filesToProcess = await convertPdfToImages(job.file);
          } else {
            filesToProcess = [job.file];
          }

          // Save page images to DB for persistence
          await Promise.all(filesToProcess.map((f, idx) => storageService.savePageImage(job.id, idx, f)));
      }

      updateStatus({ 
        status: 'processing', 
        totalPages: filesToProcess.length,
        processedPages: 0,
        progressMessage: `処理中 0/${filesToProcess.length}` 
      });

      // 2. Process pages in parallel (controlled by p-limit in geminiService)
      let completedCount = 0;

      const pagePromises = filesToProcess.map(async (pageImage, i) => {
        try {
          // Generate Blob URL for UI usage locally
          const imageUrl = URL.createObjectURL(pageImage);
          
          // Call API (Queueing handled inside service)
          const data = await processPickingList(pageImage);
          
          if (data && data.items) {
            const taggedItems = data.items.map(item => ({
              ...item,
              sourceFile: job.file.name,
              jobId: job.id,
              sourceImageUrl: imageUrl,
              pageNumber: i + 1
            }));
            
            setResultItems(prev => {
                const updated = [...prev, ...taggedItems];
                storageService.saveItems(taggedItems);
                return updated;
            });
          }

          // Update progress atomically
          completedCount++;
          updateJob(job.id, { 
            processedPages: completedCount,
            progressMessage: `Gemini 3.0 解析中 (${completedCount}/${filesToProcess.length} ページ)...` 
          });

        } catch (err) {
          console.error(`Error processing page ${i + 1}:`, err);
          // Don't fail the whole job, just log this page?
          // Or maybe mark job as partial error. For now, continue.
        }
      });

      await Promise.all(pagePromises);

      updateStatus({ 
        status: 'completed', 
        processedPages: filesToProcess.length,
        progressMessage: '完了' 
      });

    } catch (err: any) {
      console.error("Job failed:", err);
      updateStatus({ 
        status: 'error', 
        errorMessage: err.message || "処理に失敗しました",
        progressMessage: "エラー"
      });
    }
  };

  const updateJob = (id: string, updates: Partial<ProcessingJob>) => {
    setJobs(prev => {
        const newJobs = prev.map(j => j.id === id ? { ...j, ...updates } : j);
        // Persist job updates (debouncing could be good here but simple is safer)
        const updatedJob = newJobs.find(j => j.id === id);
        if (updatedJob) storageService.saveJob(updatedJob);
        return newJobs;
    });
  };

  // --- Item Management Logic ---

  const handleItemUpdate = (id: string, updates: Partial<OCRItem>) => {
    setResultItems(prev => {
        const newItems = prev.map(item => {
            if (item.id !== id) return item;
            
            const newItem = { ...item, ...updates };

            // Auto-recalculate totals if data changes
            if (updates.distributions || updates.reportedTotal !== undefined) {
                const total = newItem.distributions.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
                newItem.calculatedTotal = total;
                newItem.isCorrect = newItem.calculatedTotal === Number(newItem.reportedTotal);
            }
            
            // Persist item update
            storageService.saveItem(newItem);
            return newItem;
        });
        return newItems;
    });
  };

  const handleDeleteJob = async (jobId: string) => {
    // 1. Remove from DB
    await storageService.deleteJob(jobId);

    // 2. Remove from State
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setResultItems(prev => {
        const keptItems = [];
        const removedItems = [];
        for (const item of prev) {
            if (item.jobId === jobId) {
                removedItems.push(item);
            } else {
                keptItems.push(item);
            }
        }
        // Clean up URLs
        removedItems.forEach(item => {
            if (item.sourceImageUrl) URL.revokeObjectURL(item.sourceImageUrl);
        });
        return keptItems;
    });

    if (selectedJobId === jobId) {
        setSelectedJobId(null);
        setCurrentView('dashboard');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // 1. Remove existing items for this job
    await storageService.deleteItemsByJobId(jobId);
    setResultItems(prev => {
        const itemsToKeep = [];
        const itemsToRemove = [];
        for(const item of prev) {
            if(item.jobId === jobId) itemsToRemove.push(item);
            else itemsToKeep.push(item);
        }
        itemsToRemove.forEach(i => i.sourceImageUrl && URL.revokeObjectURL(i.sourceImageUrl));
        return itemsToKeep;
    });

    // 2. Reset job status
    const resetJob = { 
        ...job, 
        status: 'queued' as const, 
        processedPages: 0, 
        progressMessage: '再処理待機中...',
        errorMessage: undefined 
    };
    updateJob(jobId, resetJob);

    // 3. Re-run process
    processJob(resetJob);
  };

  const handleReprocessPage = async (jobId: string, pageNumber: number) => {
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;

      // 1. Find existing items for this page and remove them
      const itemsToRemove = resultItems.filter(i => i.jobId === jobId && i.pageNumber === pageNumber);
      const itemIdsToRemove = itemsToRemove.map(i => i.id);
      
      await storageService.deleteItemsByIds(itemIdsToRemove);
      setResultItems(prev => prev.filter(i => !itemIdsToRemove.includes(i.id)));

      updateJob(jobId, { progressMessage: `ページ ${pageNumber} を再解析中...` });

      try {
          // 2. Load the image for this page
          // pageNumber is 1-based, index is 0-based
          const pageIndex = pageNumber - 1;
          const blob = await storageService.getPageImage(jobId, pageIndex);
          
          if (!blob) throw new Error("Page image not found");
          
          // Create a File object for re-processing
          const imageFile = new File([blob], `${job.file.name}_p${pageIndex}.jpg`, { type: 'image/jpeg' });
          
          // Check if we already have a URL for this page in other items? 
          // Usually reprocess means we might not update the URL, but let's be safe and use the existing one if possible, or create new.
          // Simplest is create new and let cleanup handle old ones when state updates.
          const imageUrl = URL.createObjectURL(imageFile);

          // 3. Call Gemini
          const data = await processPickingList(imageFile);

          if (data && data.items) {
            const taggedItems = data.items.map(item => ({
              ...item,
              sourceFile: job.file.name,
              jobId: job.id,
              sourceImageUrl: imageUrl,
              pageNumber: pageNumber
            }));
            
            setResultItems(prev => {
                const updated = [...prev, ...taggedItems];
                storageService.saveItems(taggedItems);
                return updated;
            });
          }
          updateJob(jobId, { progressMessage: '完了' });
      } catch (e: any) {
          console.error("Reprocess failed", e);
          updateJob(jobId, { progressMessage: `ページ ${pageNumber} の再解析失敗: ${e.message}` });
      }
  };

  const clearResults = async () => {
    resultItems.forEach(item => {
      if (item.sourceImageUrl) URL.revokeObjectURL(item.sourceImageUrl);
    });
    await storageService.clearAll();
    setResultItems([]);
    setJobs([]);
    setSelectedJobId(null);
    setCurrentView('dashboard');
  };

  const handleExportCSV = () => {
    const itemsToExport = selectedJobId 
      ? resultItems.filter(item => item.jobId === selectedJobId)
      : resultItems;
    
    const filename = selectedJobId ? 'job_export' : 'all_export';
    exportToCSV(itemsToExport, filename);
  };

  // --- View Logic ---

  const displayedItems = selectedJobId 
    ? resultItems.filter(item => item.jobId === selectedJobId)
    : resultItems;

  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  // ---------------- RENDER ----------------

  if (isRestoring) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4285F4] mx-auto mb-4"></div>
                <p className="text-[#5F6368]">データを復元中...</p>
            </div>
        </div>
    );
  }

  if (currentView === 'verification' && selectedJob) {
    return (
      <VerificationView 
        job={selectedJob}
        items={displayedItems}
        onBack={() => {
          setCurrentView('dashboard');
          setSelectedJobId(null);
        }}
        onItemUpdate={handleItemUpdate}
        onExportCSV={handleExportCSV}
        onReprocessPage={(page) => handleReprocessPage(selectedJob.id, page)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#4285F4] rounded-xl text-white shadow-md shadow-blue-100">
              <ScanLine size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#202124] tracking-tight flex items-center gap-2">
                北海道三喜社 FAX OCR
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1967D2] text-[10px] font-bold uppercase tracking-wider border border-blue-100">Gemini 3.0</span>
              </h1>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-[#5F6368]">
             <div className="flex items-center gap-2 hover:text-[#202124] cursor-default"><Box size={18} /> スマート抽出</div>
             <div className="flex items-center gap-2 hover:text-[#202124] cursor-default"><Sparkles size={18} className="text-[#FBBC04]" fill="currentColor" fillOpacity={0.3} /> 自動補正</div>
             <div className="flex items-center gap-2 hover:text-[#202124] cursor-default"><FileSpreadsheet size={18} /> データ照合</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <div className="text-center max-w-3xl mx-auto py-4">
          <h2 className="text-3xl font-bold text-[#202124] mb-3 font-google">
            FAX注文書のデータ化を、瞬時に。
          </h2>
          <p className="text-[#5F6368] text-lg leading-relaxed">
            注文書（PDF/画像）をアップロードしてください。<br className="hidden sm:block"/>
            Gemini 3.0 がノイズを除去し、データを自動で構造化します。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Dropzone onFileSelect={addFilesToQueue} />
          </div>
          <div className="lg:col-span-1">
             <JobStatus 
                jobs={jobs} 
                selectedJobId={selectedJobId}
                onSelectJob={(id) => {
                  if (id) {
                    setSelectedJobId(id);
                    setCurrentView('verification');
                  } else {
                    setSelectedJobId(null);
                    setCurrentView('dashboard');
                  }
                }}
                onDeleteJob={handleDeleteJob}
                onRetryJob={handleRetryJob}
             />
          </div>
        </div>

        {resultItems.length > 0 && (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
                 <h3 className="text-xl font-bold text-[#202124] flex items-center gap-2">
                    <FileSpreadsheet className="text-[#34A853]" />
                    注文データ一覧
                 </h3>
                 <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button 
                        onClick={clearResults}
                        className="flex items-center gap-2 text-sm font-medium text-[#EA4335] hover:text-[#D93025] px-4 py-2 rounded-full hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={18} /> 全て削除
                    </button>
                    <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 text-sm font-medium text-[#174EA6] bg-white border border-[#D2E3FC] hover:bg-[#F1F3F4] px-5 py-2.5 rounded-full transition-colors shadow-sm"
                    >
                        <Download size={18} /> CSV出力
                    </button>
                 </div>
              </div>
              
              <ResultTable 
                items={resultItems} 
                onViewSource={(url, title) => {
                  setPreviewImage(url);
                  setPreviewTitle(title);
                }}
                onItemUpdate={handleItemUpdate}
              />
           </div>
        )}
      </main>

      <ImagePreviewModal 
        imageUrl={previewImage} 
        title={previewTitle}
        onClose={() => {
          setPreviewImage(null);
          setPreviewTitle("");
        }}
      />
    </div>
  );
};

export default App;