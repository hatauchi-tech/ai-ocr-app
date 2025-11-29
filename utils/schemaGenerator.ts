import { Type, Schema } from "@google/genai";
import { OCRTemplate, FieldDefinition, FieldType } from "../dynamicTypes";

/**
 * フィールド定義からGemini APIのスキーマを生成
 */
export function generateGeminiSchema(template: OCRTemplate): Schema {
  const itemProperties: Record<string, any> = {};

  template.fields.forEach(field => {
    itemProperties[field.name] = fieldToSchemaProperty(field);
  });

  return {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: itemProperties,
          required: template.fields.filter(f => f.required).map(f => f.name)
        }
      }
    }
  };
}

/**
 * フィールド定義をGeminiスキーマプロパティに変換
 */
function fieldToSchemaProperty(field: FieldDefinition): any {
  const baseProperty: any = {
    description: field.description
  };

  switch (field.type) {
    case 'string':
      return {
        ...baseProperty,
        type: Type.STRING
      };

    case 'number':
      return {
        ...baseProperty,
        type: Type.NUMBER
      };

    case 'boolean':
      return {
        ...baseProperty,
        type: Type.BOOLEAN
      };

    case 'array':
      if (field.itemFields && field.itemFields.length > 0) {
        // 構造化配列（オブジェクトの配列）
        const itemProperties: Record<string, any> = {};
        field.itemFields.forEach(itemField => {
          itemProperties[itemField.name] = fieldToSchemaProperty(itemField);
        });

        return {
          ...baseProperty,
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: itemProperties,
            required: field.itemFields.filter(f => f.required).map(f => f.name)
          }
        };
      } else {
        // プリミティブ配列（数値配列など）
        return {
          ...baseProperty,
          type: Type.ARRAY,
          items: { type: Type.NUMBER } // デフォルトは数値配列
        };
      }

    case 'object':
      if (field.properties && field.properties.length > 0) {
        const objectProperties: Record<string, any> = {};
        field.properties.forEach(prop => {
          objectProperties[prop.name] = fieldToSchemaProperty(prop);
        });

        return {
          ...baseProperty,
          type: Type.OBJECT,
          properties: objectProperties,
          required: field.properties.filter(p => p.required).map(p => p.name)
        };
      } else {
        return {
          ...baseProperty,
          type: Type.OBJECT
        };
      }

    default:
      return {
        ...baseProperty,
        type: Type.STRING
      };
  }
}

/**
 * テンプレートから動的プロンプトを生成
 */
export function generateSystemPrompt(template: OCRTemplate): string {
  // カスタムプロンプトがあればそれを使用
  if (template.systemPrompt) {
    return template.systemPrompt;
  }

  // デフォルトプロンプトを生成
  const fieldDescriptions = template.fields
    .map(field => {
      let desc = `- **${field.label} (${field.name})**:\n  - ${field.description}`;
      if (field.required) {
        desc += '\n  - 必須フィールド';
      }
      if (field.validation) {
        if (field.validation.min !== undefined) desc += `\n  - 最小値: ${field.validation.min}`;
        if (field.validation.max !== undefined) desc += `\n  - 最大値: ${field.validation.max}`;
        if (field.validation.pattern) desc += `\n  - パターン: ${field.validation.pattern}`;
      }
      return desc;
    })
    .join('\n\n');

  return `あなたは文書からデータを抽出する専門AIです。
添付された画像を読み取り、以下の[フィールド定義]に従ってデータを構造化し、JSONのみを出力してください。

## テンプレート
${template.name}: ${template.description}

## フィールド定義

${fieldDescriptions}

## 出力形式
- JSONスキーマに厳密に従ってください。
- Markdownコードブロックは不要です。
- フィールドが見つからない場合は、空文字列または null を使用してください。
- 数値は必ず数値型で出力してください（文字列ではなく）。
`;
}

/**
 * テンプレートフィールドから表示列定義を生成
 */
export interface ColumnDefinition {
  key: string;
  label: string;
  type: FieldType;
  width?: string;
  editable: boolean;
  nested?: boolean; // ネストされたフィールドの場合
}

export function generateColumnDefinitions(template: OCRTemplate): ColumnDefinition[] {
  const columns: ColumnDefinition[] = [];

  template.fields.forEach(field => {
    if (field.type === 'array' && field.itemFields) {
      // 配列フィールドは特別な表示が必要
      columns.push({
        key: field.name,
        label: field.label,
        type: 'array',
        editable: true,
        nested: true
      });
    } else if (field.type === 'object' && field.properties) {
      // オブジェクトの各プロパティを個別の列として追加（フラット化オプション）
      field.properties.forEach(prop => {
        columns.push({
          key: `${field.name}.${prop.name}`,
          label: `${field.label} - ${prop.label}`,
          type: prop.type,
          editable: true,
          nested: true
        });
      });
    } else {
      columns.push({
        key: field.name,
        label: field.label,
        type: field.type,
        editable: field.name !== 'boundingBox', // boundingBoxは通常編集不可
        nested: false
      });
    }
  });

  return columns;
}

/**
 * データ検証関数
 */
export function validateData(data: Record<string, any>, template: OCRTemplate): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  template.fields.forEach(field => {
    const value = data[field.name];

    // 必須チェック
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.label} は必須です`);
      return;
    }

    // 型チェック
    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (field.type === 'number' && actualType !== 'number') {
        errors.push(`${field.label} は数値である必要があります`);
      } else if (field.type === 'boolean' && actualType !== 'boolean') {
        errors.push(`${field.label} はブール値である必要があります`);
      } else if (field.type === 'array' && actualType !== 'array') {
        errors.push(`${field.label} は配列である必要があります`);
      } else if (field.type === 'object' && actualType !== 'object') {
        errors.push(`${field.label} はオブジェクトである必要があります`);
      }
    }

    // バリデーションルール
    if (field.validation && value !== undefined && value !== null) {
      if (field.type === 'number') {
        if (field.validation.min !== undefined && value < field.validation.min) {
          errors.push(`${field.label} は ${field.validation.min} 以上である必要があります`);
        }
        if (field.validation.max !== undefined && value > field.validation.max) {
          errors.push(`${field.label} は ${field.validation.max} 以下である必要があります`);
        }
      }

      if (field.type === 'string' && field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          errors.push(`${field.label} の形式が正しくありません`);
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
