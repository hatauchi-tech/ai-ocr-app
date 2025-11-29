import { GoogleGenAI } from "@google/genai";
import { OCRTemplate, DynamicOCRItem, DynamicOCRResult } from "../dynamicTypes";
import { generateGeminiSchema, generateSystemPrompt } from "../utils/schemaGenerator";
import pLimit from "p-limit";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Rate Limiting
const CONCURRENCY_LIMIT = 3;
const limit = pLimit(CONCURRENCY_LIMIT);

/**
 * 動的テンプレートを使用してOCR処理を実行
 */
export const processDynamicPickingList = (
  file: File,
  template: OCRTemplate
): Promise<DynamicOCRResult> => {
  return limit(async () => {
    const base64Data = await fileToBase64(file);

    try {
      const schema = generateGeminiSchema(template);
      const systemPrompt = generateSystemPrompt(template);

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            },
            {
              text: systemPrompt,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0,
          maxOutputTokens: 65536,
        },
      });

      const text = cleanResponseText(response.text);
      if (!text) throw new Error("No valid JSON response from Gemini.");

      const rawResult = JSON.parse(text) as { items: any[] };

      // 動的アイテムにマッピング
      const items = rawResult.items.map(item => mapToDynamicOCRItem(item, template.id));

      return { items };

    } catch (error) {
      console.error("Dynamic OCR Processing Error:", error);
      throw error;
    }
  });
};

const cleanResponseText = (text: string | undefined): string => {
  if (!text) return "";
  let cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  return cleaned;
};

const mapToDynamicOCRItem = (rawItem: any, templateId: string): DynamicOCRItem => {
  return {
    id: Math.random().toString(36).substring(2, 11),
    templateId: templateId,
    isVerified: false,
    data: rawItem,
    boundingBox: rawItem.boundingBox || rawItem.box_2d || undefined
  };
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.split(",")[1]);
      } else {
        reject(new Error("Failed to read file."));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};
