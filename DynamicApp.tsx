import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DynamicOCRItem, OCRTemplate } from './dynamicTypes';
import { ProcessingJob } from './types';
import { processDynamicPickingList } from './services/dynamicGeminiService';
import { convertPdfToImages } from './services/pdfService';
import { templateService } from './services/templateService';
import { exportDynamicToCSV } from './utils/dynamicCsvHelper';
import Dropzone from './components/Dropzone';
import DynamicResultTable from './components/DynamicResultTable';
import TemplateSelector from './components/TemplateSelector';
import JobStatus from './components/JobStatus';
import { ScanLine, Trash2, Download, FileSpreadsheet } from 'lucide-react';

const DynamicApp: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<OCRTemplate | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [resultItems, setResultItems] = useState<DynamicOCRItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 初期化: デフォルトテンプレートを読み込み
  useEffect(() => {
    const init = async () => {
      try {
        const templates = await templateService.getAllTemplates();
        if (templates.length > 0) {
          setSelectedTemplate(templates[0]);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleTemplateSelect = async (templateId: string) => {
    try {
      const template = await templateService.getTemplate(templateId);
      if (template) {
        setSelectedTemplate(template);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  const addFilesToQueue = useCallback((files: File[]) => {
    if (!selectedTemplate) {
      alert('テンプレートを選択してください');
      return;
    }

    const newJobs: ProcessingJob[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'queued',
      totalPages: 0,
      processedPages: 0,
      progressMessage: '待機中...',
      addedAt: Date.now(),
      templateId: selectedTemplate.id
    }));

    setJobs(prev => [...prev, ...newJobs]);

    newJobs.forEach(job => processJob(job));
  }, [selectedTemplate]);

  const processJob = async (job: ProcessingJob) => {
    const updateStatus = (updates: Partial<ProcessingJob>) => updateJob(job.id, updates);

    try {
      updateStatus({ status: 'converting', progressMessage: 'ファイルを準備中...' });

      // PDF変換
      let filesToProcess: File[] = [];

      if (job.file.type === 'application/pdf') {
        updateStatus({ status: 'converting', progressMessage: 'PDFを画像に変換中...' });
        filesToProcess = await convertPdfToImages(job.file);
      } else {
        filesToProcess = [job.file];
      }

      updateStatus({
        status: 'processing',
        totalPages: filesToProcess.length,
        processedPages: 0,
        progressMessage: `処理中 0/${filesToProcess.length}`
      });

      // テンプレートを取得
      const template = await templateService.getTemplate(job.templateId!);
      if (!template) {
        throw new Error('テンプレートが見つかりません');
      }

      // 各ページを処理
      let completedCount = 0;

      const pagePromises = filesToProcess.map(async (pageImage, i) => {
        try {
          const imageUrl = URL.createObjectURL(pageImage);

          const data = await processDynamicPickingList(pageImage, template);

          if (data && data.items) {
            const taggedItems = data.items.map(item => ({
              ...item,
              sourceFile: job.file.name,
              jobId: job.id,
              sourceImageUrl: imageUrl,
              pageNumber: i + 1
            }));

            setResultItems(prev => [...prev, ...taggedItems]);
          }

          completedCount++;
          updateJob(job.id, {
            processedPages: completedCount,
            progressMessage: `Gemini 3.0 解析中 (${completedCount}/${filesToProcess.length} ページ)...`
          });

        } catch (err) {
          console.error(`Error processing page ${i + 1}:`, err);
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
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const handleItemUpdate = (id: string, updates: Partial<DynamicOCRItem>) => {
    setResultItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('このジョブを削除しますか？')) return;

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

      removedItems.forEach(item => {
        if (item.sourceImageUrl) URL.revokeObjectURL(item.sourceImageUrl);
      });

      return keptItems;
    });
  };

  const handleRetryJob = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setResultItems(prev => {
      const itemsToKeep = [];
      const itemsToRemove = [];

      for (const item of prev) {
        if (item.jobId === jobId) itemsToRemove.push(item);
        else itemsToKeep.push(item);
      }

      itemsToRemove.forEach(i => i.sourceImageUrl && URL.revokeObjectURL(i.sourceImageUrl));
      return itemsToKeep;
    });

    const resetJob = {
      ...job,
      status: 'queued' as const,
      processedPages: 0,
      progressMessage: '再処理待機中...',
      errorMessage: undefined
    };

    updateJob(jobId, resetJob);
    processJob(resetJob);
  };

  const clearResults = async () => {
    if (!confirm('すべてのデータを削除しますか？')) return;

    resultItems.forEach(item => {
      if (item.sourceImageUrl) URL.revokeObjectURL(item.sourceImageUrl);
    });

    setResultItems([]);
    setJobs([]);
  };

  const handleExportCSV = () => {
    if (!selectedTemplate) return;
    exportDynamicToCSV(resultItems, selectedTemplate, selectedTemplate.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4285F4] mx-auto mb-4"></div>
          <p className="text-[#5F6368]">データを読み込み中...</p>
        </div>
      </div>
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
                汎用 AI OCR システム
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1967D2] text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                  Gemini 3.0
                </span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="text-center max-w-3xl mx-auto py-4">
          <h2 className="text-3xl font-bold text-[#202124] mb-3 font-google">
            あらゆる文書を、AIで構造化データに。
          </h2>
          <p className="text-[#5F6368] text-lg leading-relaxed">
            テンプレートを選択して文書をアップロードしてください。<br className="hidden sm:block"/>
            Gemini 3.0 があなた好みのフォーマットでデータを抽出します。
          </p>
        </div>

        {/* Template Selector + Upload + Job Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <TemplateSelector
              selectedTemplateId={selectedTemplate?.id || null}
              onSelectTemplate={handleTemplateSelect}
            />
          </div>
          <div className="lg:col-span-1">
            <Dropzone onFileSelect={addFilesToQueue} />
          </div>
          <div className="lg:col-span-1">
            <JobStatus
              jobs={jobs}
              selectedJobId={null}
              onSelectJob={() => {}}
              onDeleteJob={handleDeleteJob}
              onRetryJob={handleRetryJob}
            />
          </div>
        </div>

        {/* Results */}
        {resultItems.length > 0 && selectedTemplate && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-bold text-[#202124] flex items-center gap-2">
                <FileSpreadsheet className="text-[#34A853]" />
                抽出データ一覧
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

            <DynamicResultTable
              items={resultItems}
              template={selectedTemplate}
              onItemUpdate={handleItemUpdate}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default DynamicApp;
