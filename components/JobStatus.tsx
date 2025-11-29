import React from 'react';
import { ProcessingJob } from '../types';
import { Loader2, CheckCircle2, XCircle, Clock, List, Trash2, RefreshCw } from 'lucide-react';

interface JobStatusProps {
  jobs: ProcessingJob[];
  selectedJobId: string | null;
  onSelectJob: (id: string | null) => void;
  onDeleteJob?: (id: string) => void;
  onRetryJob?: (id: string) => void;
}

const JobStatus: React.FC<JobStatusProps> = ({ jobs, selectedJobId, onSelectJob, onDeleteJob, onRetryJob }) => {
  if (jobs.length === 0) return null;

  const sortedJobs = [...jobs].sort((a, b) => {
    const score = (status: string) => {
      if (status === 'processing' || status === 'converting') return 3;
      if (status === 'queued') return 2;
      return 1;
    };
    const scoreA = score(a.status);
    const scoreB = score(b.status);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.addedAt - a.addedAt;
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("このジョブを削除しますか？") && onDeleteJob) {
        onDeleteJob(id);
    }
  };

  const handleRetry = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("このジョブを最初から再処理しますか？\n現在の修正内容は失われます。") && onRetryJob) {
        onRetryJob(id);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2">
      <div className="px-5 py-4 border-b border-slate-100 bg-[#F8F9FA] flex justify-between items-center">
        <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
            処理状況
        </h3>
        
        {selectedJobId ? (
             <button 
                onClick={(e) => { e.stopPropagation(); onSelectJob(null); }}
                className="text-xs flex items-center gap-1 text-[#4285F4] hover:text-blue-700 font-medium px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors"
             >
                <List size={12} /> 全て表示
             </button>
        ) : (
            <span className="text-xs text-[#5F6368] bg-slate-200 px-2 py-0.5 rounded-full">{jobs.length} ファイル</span>
        )}
      </div>
      <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
        {sortedJobs.map((job) => {
            const isSelected = selectedJobId === job.id;
            const isProcessing = job.status === 'processing' || job.status === 'converting' || job.status === 'queued';
            
            return (
              <div 
                key={job.id} 
                onClick={() => onSelectJob(isSelected ? null : job.id)}
                className={`
                    px-5 py-3 flex items-center justify-between gap-4 cursor-pointer transition-all duration-200 group
                    ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-[#F8F9FA]'}
                `}
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <div className={`
                    p-2 rounded-full shrink-0 transition-colors
                    ${job.status === 'completed' ? 'bg-green-100 text-[#34A853]' : 
                      job.status === 'error' ? 'bg-red-100 text-[#EA4335]' : 
                      'bg-blue-100 text-[#4285F4]'}
                  `}>
                    {job.status === 'processing' || job.status === 'converting' ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : job.status === 'completed' ? (
                      <CheckCircle2 size={18} />
                    ) : job.status === 'error' ? (
                      <XCircle size={18} />
                    ) : (
                      <Clock size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-[#174EA6]' : 'text-[#202124]'}`}>
                      {job.file.name}
                    </p>
                    <p className="text-xs text-[#5F6368] truncate">
                      {job.status === 'error' ? (
                        <span className="text-[#EA4335]">{job.errorMessage}</span>
                      ) : (
                        job.progressMessage
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="shrink-0 flex flex-col items-end gap-1">
                     {isProcessing && job.totalPages > 0 ? (
                      <div className="w-16 sm:w-20">
                        <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#4285F4] transition-all duration-500"
                            style={{ width: `${(job.processedPages / job.totalPages) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isProcessing && onRetryJob && (
                                <button 
                                    onClick={(e) => handleRetry(e, job.id)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                    title="再処理"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}
                            {onDeleteJob && (
                                <button 
                                    onClick={(e) => handleDelete(e, job.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    title="削除"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};

export default JobStatus;