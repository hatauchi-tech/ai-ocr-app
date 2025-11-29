import React, { useState, useEffect } from 'react';
import { OCRTemplate } from '../dynamicTypes';
import { templateService } from '../services/templateService';
import { FileText, Plus, Download, Upload, Copy, Trash2, Settings } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate?: () => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplateId,
  onSelectTemplate,
  onCreateTemplate
}) => {
  const [templates, setTemplates] = useState<OCRTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const allTemplates = await templateService.getAllTemplates();
      setTemplates(allTemplates);

      // デフォルトテンプレートを選択
      if (!selectedTemplateId && allTemplates.length > 0) {
        onSelectTemplate(allTemplates[0].id);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      const newTemplate = await templateService.duplicateTemplate(templateId);
      await loadTemplates();
      onSelectTemplate(newTemplate.id);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
      alert('テンプレートの複製に失敗しました');
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return;

    try {
      await templateService.deleteTemplate(templateId);
      await loadTemplates();

      if (selectedTemplateId === templateId && templates.length > 0) {
        onSelectTemplate(templates[0].id);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert(error instanceof Error ? error.message : 'テンプレートの削除に失敗しました');
    }
  };

  const handleExport = async (templateId: string) => {
    try {
      const template = await templateService.getTemplate(templateId);
      if (!template) return;

      const json = templateService.exportTemplate(template);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export template:', error);
      alert('テンプレートのエクスポートに失敗しました');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        await templateService.importTemplate(text);
        await loadTemplates();
        alert('テンプレートをインポートしました');
      } catch (error) {
        console.error('Failed to import template:', error);
        alert(error instanceof Error ? error.message : 'テンプレートのインポートに失敗しました');
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <p className="text-sm text-[#5F6368]">テンプレートを読み込み中...</p>
      </div>
    );
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 bg-[#F8F9FA] flex justify-between items-center">
        <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
          <Settings size={18} className="text-[#4285F4]" />
          OCRテンプレート
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="p-1.5 text-slate-400 hover:text-[#4285F4] hover:bg-blue-50 rounded-full transition-colors"
            title="テンプレートをインポート"
          >
            <Upload size={16} />
          </button>
          {onCreateTemplate && (
            <button
              onClick={onCreateTemplate}
              className="p-1.5 text-slate-400 hover:text-[#34A853] hover:bg-green-50 rounded-full transition-colors"
              title="新規テンプレート"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {templates.map(template => {
          const isSelected = template.id === selectedTemplateId;
          const isDefault = template.id.startsWith('hokkaido-sanki') || template.id.startsWith('generic-invoice');

          return (
            <div
              key={template.id}
              className={`
                p-3 rounded-xl border-2 cursor-pointer transition-all group
                ${isSelected
                  ? 'border-[#4285F4] bg-blue-50'
                  : 'border-slate-200 hover:border-[#4285F4] hover:bg-slate-50'}
              `}
              onClick={() => onSelectTemplate(template.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className={isSelected ? 'text-[#4285F4]' : 'text-[#5F6368]'} />
                    <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-[#174EA6]' : 'text-[#202124]'}`}>
                      {template.name}
                    </h4>
                    {isDefault && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-[#1967D2] font-bold">
                        デフォルト
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5F6368] mt-1 truncate">
                    {template.description}
                  </p>
                  <p className="text-[10px] text-[#80868B] mt-1">
                    {template.fields.length} フィールド
                  </p>
                </div>

                <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(template.id); }}
                    className="p-1.5 text-slate-400 hover:text-[#4285F4] hover:bg-blue-50 rounded-full"
                    title="エクスポート"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(template.id); }}
                    className="p-1.5 text-slate-400 hover:text-[#34A853] hover:bg-green-50 rounded-full"
                    title="複製"
                  >
                    <Copy size={14} />
                  </button>
                  {!isDefault && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                      className="p-1.5 text-slate-400 hover:text-[#EA4335] hover:bg-red-50 rounded-full"
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedTemplate && (
        <div className="px-5 py-3 border-t border-slate-100 bg-[#F8F9FA]">
          <p className="text-xs text-[#5F6368]">
            <span className="font-bold text-[#202124]">{selectedTemplate.name}</span> を使用して処理します
          </p>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
