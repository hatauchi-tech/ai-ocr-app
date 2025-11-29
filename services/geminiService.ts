import { GoogleGenAI, Type, Schema } from "@google/genai";
import { OCRResult, OCRItem, Distribution } from "../types";
import pLimit from "p-limit";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Rate Limiting ---
// Gemini API has limits (e.g. 15 RPM for free tier, higher for paid).
// We limit concurrent requests to avoid 429 errors and ensure stability.
const CONCURRENCY_LIMIT = 3;
const limit = pLimit(CONCURRENCY_LIMIT);

// --- Constants & Configuration ---

// Optimized schema: Use short keys and a string for distributions to save tokens
const EXTRACTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          no: { type: Type.STRING, description: "Row number" },
          jan: { type: Type.STRING, description: "JAN Code" },
          name: { 
            type: Type.STRING, 
            description: "Product Name from 3rd Column UPPER row. IGNORE numbers in LOWER row." 
          },
          vCode: { 
            type: Type.STRING, 
            description: "Vendor Product Code from 4th Column UPPER row (e.g., E90604)." 
          },
          sz: { 
            type: Type.STRING, 
            description: "Size from 4th Column LOWER row, LEFT. Correct '1150' -> '150' if needed." 
          },
          col: { 
            type: Type.STRING, 
            description: "Color from 4th Column LOWER row, RIGHT." 
          },
          rTotal: { type: Type.NUMBER, description: "Reported Total (帳票総数) from 'Irisou' column LOWER row." },
          dists: {
            type: Type.STRING,
            description: "String format: 'ShopCode:Quantity|ShopCode:Quantity'.",
          },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Bounding box [ymin, xmin, ymax, xmax] (0-1000 scale). MUST accurately frame the specific data row visually. Do NOT rely on estimated line heights.",
          },
        },
        required: ["no", "rTotal", "dists", "box_2d"],
      },
    },
  },
};

const SYSTEM_PROMPT = `
  あなたは「北海道三喜社」のFAX注文書（配送ピッキングリスト）処理に特化した専門AIです。
  添付の画像を読み取り、以下の[処理ルール]に従ってデータを構造化し、JSONのみを出力してください。

  ## 1. データ抽出・クリーニングルール (最重要)
  画像内の表構造（特に3列目・4列目）を詳細に解釈してください。
  
  **注意:** 表のヘッダー行（項目名）は抽出しないでください。具体的な商品データ（No.1〜）のみを抽出対象としてください。

  - **商品名 (name)**:
    - 3列目「商品名/品番」の**上段**のテキストのみを抽出してください。
    - 下段の数値は無視してください。

  - **サイズ (sz)**:
    - 4列目「サイズ・カラー/取引先品番」の**下段・左側**にある数値を抽出。
    - 縦罫線が「1」と誤認識される場合（1150 -> 150）は補正してください。

  - **カラー (col)**:
    - 4列目「サイズ・カラー/取引先品番」の**下段・右側**にある色名を抽出。

  - **取引先品番 (vCode)**:
    - 4列目の**上段**にある英数字を抽出。

  - **帳票総数 (rTotal)**:
    - 「イリソウ（入数/総数）」列の**下段**の数値を採用。

  - **配送内訳 (dists)**:
    - 右側の「店コード」と「数量」のペアを抽出。形式: "店コード:数量|..."
  
  - **位置情報 (box_2d) の重要ルール**:
    - 各行のデータの範囲を示す [ymin, xmin, ymax, xmax] (0-1000正規化座標) を出力してください。
    - **ズレ防止:** FAX画像は行間が不均一な場合があります。平均的な行の高さで推測せず、**必ず実際の破線（行区切り線）を目視して**、その行の正確なY座標範囲を取得してください。
    - 行番号が進むにつれて座標が上にズレないよう、1行ずつ確実に位置を特定してください。
    - ヘッダー行は含めないでください。

  ## 2. 出力形式
  - JSONスキーマに従ってください。Markdownコードブロックは不要です。
`;

// --- Main Service Function ---

/**
 * Processes a picking list image using Gemini with rate limiting.
 */
export const processPickingList = (file: File): Promise<OCRResult> => {
  return limit(async () => {
    const base64Data = await fileToBase64(file);

    try {
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
              text: SYSTEM_PROMPT,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_SCHEMA,
          temperature: 0, // Deterministic extraction
          maxOutputTokens: 65536,
        },
      });

      const text = cleanResponseText(response.text);
      if (!text) throw new Error("No valid JSON response from Gemini.");

      const rawResult = JSON.parse(text) as { items: any[] };
      const items = rawResult.items.map(mapRawItemToOCRItem);

      return { items };

    } catch (error) {
      console.error("OCR Processing Error:", error);
      throw error;
    }
  });
};

// --- Helper Functions ---

const cleanResponseText = (text: string | undefined): string => {
  if (!text) return "";
  // Remove Markdown code blocks if present
  let cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  // Ensure we only have the JSON object
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  return cleaned;
};

const mapRawItemToOCRItem = (item: any): OCRItem => {
  // 1. Parse Distribution String
  const distributions: Distribution[] = [];
  if (item.dists && typeof item.dists === 'string') {
    const parts = item.dists.split('|');
    for (const part of parts) {
      const [shop, qty] = part.split(':');
      if (shop && qty) {
        distributions.push({
          shopCode: shop.trim(),
          quantity: parseInt(qty.trim()) || 0
        });
      }
    }
  }

  // 2. Calculate Totals
  const reportedTotal = Number(item.rTotal) || 0;
  const calculatedTotal = distributions.reduce((sum, d) => sum + d.quantity, 0);

  // 3. Clean Vendor Product Code
  // Rule: "0000 00 995668D" -> "995668D" (Take last part if separated by spaces)
  let vendorProductCode = item.vCode || "";
  if (vendorProductCode) {
    const normalized = vendorProductCode.replace(/[\s\u3000\t\r\n\u00A0]+/g, ' ').trim();
    const parts = normalized.split(' ');
    if (parts.length > 0) {
      vendorProductCode = parts[parts.length - 1];
    }
  }

  return {
    id: Math.random().toString(36).substring(2, 11),
    no: item.no || "",
    janCode: item.jan || "",
    productName: item.name || "",
    vendorProductCode: vendorProductCode,
    size: item.sz || "",
    color: item.col || "",
    reportedTotal: reportedTotal,
    distributions: distributions,
    calculatedTotal: calculatedTotal,
    isCorrect: calculatedTotal === reportedTotal,
    isVerified: false,
    boundingBox: item.box_2d || undefined
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