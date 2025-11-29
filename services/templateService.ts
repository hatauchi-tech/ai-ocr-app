import { openDB, DBSchema } from 'idb';
import { OCRTemplate, DEFAULT_TEMPLATES } from '../dynamicTypes';

interface TemplateDB extends DBSchema {
  templates: {
    key: string;
    value: OCRTemplate;
  };
}

const DB_NAME = 'ocr_templates_db';
const DB_VERSION = 1;

// Initialize DB
const getDB = async () => {
  return openDB<TemplateDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
    },
  });
};

export const templateService = {
  /**
   * すべてのテンプレートを取得
   */
  async getAllTemplates(): Promise<OCRTemplate[]> {
    const db = await getDB();
    const stored = await db.getAll('templates');

    // デフォルトテンプレートと保存済みテンプレートをマージ
    // 保存済みテンプレートが優先
    const storedIds = stored.map(t => t.id);
    const defaultsNotStored = DEFAULT_TEMPLATES.filter(t => !storedIds.includes(t.id));

    return [...stored, ...defaultsNotStored];
  },

  /**
   * テンプレートIDでテンプレートを取得
   */
  async getTemplate(id: string): Promise<OCRTemplate | undefined> {
    const db = await getDB();
    const template = await db.get('templates', id);

    if (template) return template;

    // デフォルトテンプレートから検索
    return DEFAULT_TEMPLATES.find(t => t.id === id);
  },

  /**
   * テンプレートを保存
   */
  async saveTemplate(template: OCRTemplate): Promise<void> {
    const db = await getDB();
    const now = Date.now();

    const templateToSave: OCRTemplate = {
      ...template,
      updatedAt: now,
      createdAt: template.createdAt || now
    };

    await db.put('templates', templateToSave);
  },

  /**
   * テンプレートを削除
   */
  async deleteTemplate(id: string): Promise<void> {
    // デフォルトテンプレートは削除不可
    if (DEFAULT_TEMPLATES.some(t => t.id === id)) {
      throw new Error('デフォルトテンプレートは削除できません');
    }

    const db = await getDB();
    await db.delete('templates', id);
  },

  /**
   * テンプレートを複製
   */
  async duplicateTemplate(id: string, newName?: string): Promise<OCRTemplate> {
    const original = await this.getTemplate(id);

    if (!original) {
      throw new Error('テンプレートが見つかりません');
    }

    const newId = `${original.id}-copy-${Date.now()}`;
    const newTemplate: OCRTemplate = {
      ...original,
      id: newId,
      name: newName || `${original.name} (コピー)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.saveTemplate(newTemplate);
    return newTemplate;
  },

  /**
   * テンプレートをエクスポート（JSON）
   */
  exportTemplate(template: OCRTemplate): string {
    return JSON.stringify(template, null, 2);
  },

  /**
   * テンプレートをインポート（JSON）
   */
  async importTemplate(jsonString: string): Promise<OCRTemplate> {
    try {
      const template = JSON.parse(jsonString) as OCRTemplate;

      // 基本的なバリデーション
      if (!template.id || !template.name || !template.fields || !Array.isArray(template.fields)) {
        throw new Error('無効なテンプレート形式です');
      }

      // 重複IDの場合は新しいIDを生成
      const existing = await this.getTemplate(template.id);
      if (existing) {
        template.id = `${template.id}-imported-${Date.now()}`;
        template.name = `${template.name} (インポート)`;
      }

      await this.saveTemplate(template);
      return template;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`インポートに失敗しました: ${error.message}`);
      }
      throw error;
    }
  },

  /**
   * デフォルトテンプレートをリセット
   */
  async resetDefaultTemplates(): Promise<void> {
    const db = await getDB();

    // デフォルトテンプレートのIDを削除
    for (const template of DEFAULT_TEMPLATES) {
      try {
        await db.delete('templates', template.id);
      } catch (e) {
        // エラーは無視（存在しない場合）
      }
    }
  },

  /**
   * すべてのカスタムテンプレートを削除
   */
  async clearAll(): Promise<void> {
    const db = await getDB();
    await db.clear('templates');
  }
};
