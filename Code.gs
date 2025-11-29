/**
 * 汎用 AI OCR システム - Google Apps Script Backend
 *
 * このスクリプトはGAS環境でOCRアプリケーションを実行するためのバックエンドです。
 *
 * 必要な設定:
 * 1. スクリプトプロパティに GEMINI_API_KEY を設定
 * 2. Google Drive API を有効化
 * 3. 適切な OAuth スコープを設定
 */

// ==================== Constants ====================

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent';
const CONCURRENCY_LIMIT = 3; // 同時処理数
const MAX_IMAGE_DIMENSION = 2500; // 最大画像サイズ

// ==================== Main Entry Point ====================

/**
 * Webアプリのエントリーポイント
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('汎用 AI OCR システム - Gemini Powered')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * HTMLファイルにJavaScriptやCSSをインクルードする
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==================== Gemini API ====================

/**
 * Gemini APIでOCR処理を実行
 * @param {string} base64Image - Base64エンコードされた画像データ
 * @param {string} mimeType - 画像のMIMEタイプ
 * @return {Object} OCR結果
 */
function processImageWithGemini(base64Image, mimeType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY がスクリプトプロパティに設定されていません');
  }

  const systemPrompt = `
  あなたはFAX注文書や配送ピッキングリストなどの文書処理に特化した専門AIです。
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

  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            no: { type: "string", description: "Row number" },
            jan: { type: "string", description: "JAN Code" },
            name: {
              type: "string",
              description: "Product Name from 3rd Column UPPER row. IGNORE numbers in LOWER row."
            },
            vCode: {
              type: "string",
              description: "Vendor Product Code from 4th Column UPPER row (e.g., E90604)."
            },
            sz: {
              type: "string",
              description: "Size from 4th Column LOWER row, LEFT. Correct '1150' -> '150' if needed."
            },
            col: {
              type: "string",
              description: "Color from 4th Column LOWER row, RIGHT."
            },
            rTotal: { type: "number", description: "Reported Total (帳票総数) from 'Irisou' column LOWER row." },
            dists: {
              type: "string",
              description: "String format: 'ShopCode:Quantity|ShopCode:Quantity'.",
            },
            box_2d: {
              type: "array",
              items: { type: "number" },
              description: "Bounding box [ymin, xmin, ymax, xmax] (0-1000 scale). MUST accurately frame the specific data row visually.",
            },
          },
          required: ["no", "rTotal", "dists", "box_2d"],
        },
      },
    },
  };

  const payload = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Image
          }
        },
        {
          text: systemPrompt
        }
      ]
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const url = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error(`Gemini API Error (${responseCode}): ${response.getContentText()}`);
  }

  const result = JSON.parse(response.getContentText());

  if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
    throw new Error('Invalid response from Gemini API');
  }

  const textContent = result.candidates[0].content.parts[0].text;
  const cleanedText = cleanResponseText(textContent);
  const rawResult = JSON.parse(cleanedText);

  // データ変換
  const items = rawResult.items.map(item => mapRawItemToOCRItem(item));

  return { items: items };
}

/**
 * レスポンステキストのクリーニング
 */
function cleanResponseText(text) {
  if (!text) return "";
  let cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  return cleaned;
}

/**
 * RawデータをOCRItemに変換
 */
function mapRawItemToOCRItem(item) {
  // 配送内訳のパース
  const distributions = [];
  if (item.dists && typeof item.dists === 'string') {
    const parts = item.dists.split('|');
    for (let i = 0; i < parts.length; i++) {
      const [shop, qty] = parts[i].split(':');
      if (shop && qty) {
        distributions.push({
          shopCode: shop.trim(),
          quantity: parseInt(qty.trim()) || 0
        });
      }
    }
  }

  // 合計計算
  const reportedTotal = Number(item.rTotal) || 0;
  const calculatedTotal = distributions.reduce((sum, d) => sum + d.quantity, 0);

  // メーカー品番のクリーニング
  let vendorProductCode = item.vCode || "";
  if (vendorProductCode) {
    const normalized = vendorProductCode.replace(/[\s\u3000\t\r\n\u00A0]+/g, ' ').trim();
    const parts = normalized.split(' ');
    if (parts.length > 0) {
      vendorProductCode = parts[parts.length - 1];
    }
  }

  return {
    id: Utilities.getUuid(),
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
}

// ==================== PDF Processing ====================

/**
 * PDFファイルをページ画像に変換
 * @param {Blob} pdfBlob - PDFファイルのBlob
 * @return {Array} Base64エンコードされた画像の配列
 */
function convertPdfToImages(pdfBlob) {
  // GAS環境ではPDF.jsが使えないため、Google Drive APIを使用
  // PDFをDriveにアップロード → サムネイル取得という方法もあるが、
  // より簡単な方法として、PDFを直接Geminiに送る方法を採用

  // 注: Gemini APIはPDFを直接処理できるため、
  // この関数では単にページごとに分割する処理を実装

  // 簡易実装: PDFを1つの画像として扱う
  // 本格的な実装では、pdf-lib などのライブラリを使用する必要がある

  return [{
    data: Utilities.base64Encode(pdfBlob.getBytes()),
    mimeType: 'application/pdf'
  }];
}

/**
 * 画像ファイルをBase64に変換
 * @param {Blob} blob - 画像Blob
 * @return {Object} Base64データとMIMEタイプ
 */
function blobToBase64(blob) {
  return {
    data: Utilities.base64Encode(blob.getBytes()),
    mimeType: blob.getContentType()
  };
}

// ==================== Storage Service (Google Sheets) ====================

/**
 * データストレージ用のスプレッドシートを取得または作成
 */
function getOrCreateStorageSheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('STORAGE_SHEET_ID');

  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      Logger.log('Stored sheet not found, creating new one');
    }
  }

  // 新しいスプレッドシートを作成
  const ss = SpreadsheetApp.create('Hokkaido Sanki OCR Data');
  PropertiesService.getScriptProperties().setProperty('STORAGE_SHEET_ID', ss.getId());

  // シートを初期化
  const jobsSheet = ss.getSheetByName('Sheet1');
  jobsSheet.setName('Jobs');
  jobsSheet.getRange('A1:F1').setValues([['ID', 'FileName', 'Status', 'TotalPages', 'ProcessedPages', 'Message']]);

  const itemsSheet = ss.insertSheet('Items');
  itemsSheet.getRange('A1:N1').setValues([
    ['ID', 'JobID', 'No', 'ProductName', 'JANCode', 'VendorCode', 'Size', 'Color',
     'ReportedTotal', 'CalculatedTotal', 'IsCorrect', 'IsVerified', 'PageNumber', 'Distributions']
  ]);

  return ss;
}

/**
 * ジョブを保存
 */
function saveJob(job) {
  const ss = getOrCreateStorageSheet();
  const sheet = ss.getSheetByName('Jobs');

  // 既存のジョブを検索
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === job.id) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowData = [
    job.id,
    job.fileName,
    job.status,
    job.totalPages,
    job.processedPages,
    job.progressMessage
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 6).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

/**
 * アイテムを保存
 */
function saveItems(items, jobId) {
  const ss = getOrCreateStorageSheet();
  const sheet = ss.getSheetByName('Items');

  items.forEach(item => {
    const rowData = [
      item.id,
      jobId,
      item.no,
      item.productName,
      item.janCode,
      item.vendorProductCode,
      item.size,
      item.color,
      item.reportedTotal,
      item.calculatedTotal,
      item.isCorrect,
      item.isVerified,
      item.pageNumber || 1,
      JSON.stringify(item.distributions)
    ];

    sheet.appendRow(rowData);
  });
}

/**
 * すべてのジョブを取得
 */
function loadAllJobs() {
  try {
    const ss = getOrCreateStorageSheet();
    const sheet = ss.getSheetByName('Jobs');
    const data = sheet.getDataRange().getValues();

    const jobs = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        jobs.push({
          id: data[i][0],
          fileName: data[i][1],
          status: data[i][2],
          totalPages: data[i][3],
          processedPages: data[i][4],
          progressMessage: data[i][5]
        });
      }
    }

    return jobs;
  } catch (e) {
    return [];
  }
}

/**
 * すべてのアイテムを取得
 */
function loadAllItems() {
  try {
    const ss = getOrCreateStorageSheet();
    const sheet = ss.getSheetByName('Items');
    const data = sheet.getDataRange().getValues();

    const items = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        items.push({
          id: data[i][0],
          jobId: data[i][1],
          no: data[i][2],
          productName: data[i][3],
          janCode: data[i][4],
          vendorProductCode: data[i][5],
          size: data[i][6],
          color: data[i][7],
          reportedTotal: data[i][8],
          calculatedTotal: data[i][9],
          isCorrect: data[i][10],
          isVerified: data[i][11],
          pageNumber: data[i][12],
          distributions: JSON.parse(data[i][13] || '[]')
        });
      }
    }

    return items;
  } catch (e) {
    return [];
  }
}

/**
 * ジョブを削除
 */
function deleteJob(jobId) {
  const ss = getOrCreateStorageSheet();

  // Jobsシートから削除
  const jobsSheet = ss.getSheetByName('Jobs');
  const jobsData = jobsSheet.getDataRange().getValues();
  for (let i = 1; i < jobsData.length; i++) {
    if (jobsData[i][0] === jobId) {
      jobsSheet.deleteRow(i + 1);
      break;
    }
  }

  // Itemsシートから削除
  const itemsSheet = ss.getSheetByName('Items');
  const itemsData = itemsSheet.getDataRange().getValues();
  for (let i = itemsData.length - 1; i >= 1; i--) {
    if (itemsData[i][1] === jobId) {
      itemsSheet.deleteRow(i + 1);
    }
  }
}

/**
 * すべてのデータをクリア
 */
function clearAllData() {
  const ss = getOrCreateStorageSheet();

  const jobsSheet = ss.getSheetByName('Jobs');
  if (jobsSheet.getLastRow() > 1) {
    jobsSheet.deleteRows(2, jobsSheet.getLastRow() - 1);
  }

  const itemsSheet = ss.getSheetByName('Items');
  if (itemsSheet.getLastRow() > 1) {
    itemsSheet.deleteRows(2, itemsSheet.getLastRow() - 1);
  }
}

// ==================== Public API Functions ====================

/**
 * ファイルを処理してOCR実行（フロントエンドから呼ばれる）
 */
function processFile(fileData, fileName, jobId) {
  try {
    // ジョブを保存
    saveJob({
      id: jobId,
      fileName: fileName,
      status: 'processing',
      totalPages: 1,
      processedPages: 0,
      progressMessage: '処理中...'
    });

    // Base64デコード
    const bytes = Utilities.base64Decode(fileData.split(',')[1]);
    const blob = Utilities.newBlob(bytes, fileData.split(';')[0].split(':')[1], fileName);

    // PDF or Image
    let imagesToProcess = [];
    if (blob.getContentType() === 'application/pdf') {
      imagesToProcess = convertPdfToImages(blob);
    } else {
      imagesToProcess = [blobToBase64(blob)];
    }

    // OCR処理
    const allItems = [];
    for (let i = 0; i < imagesToProcess.length; i++) {
      const imageData = imagesToProcess[i];
      const result = processImageWithGemini(imageData.data, imageData.mimeType);

      // ページ番号を追加
      result.items.forEach(item => {
        item.pageNumber = i + 1;
        item.jobId = jobId;
      });

      allItems.push(...result.items);

      // 進捗更新
      saveJob({
        id: jobId,
        fileName: fileName,
        status: 'processing',
        totalPages: imagesToProcess.length,
        processedPages: i + 1,
        progressMessage: `処理中 ${i + 1}/${imagesToProcess.length}`
      });
    }

    // アイテムを保存
    saveItems(allItems, jobId);

    // ジョブ完了
    saveJob({
      id: jobId,
      fileName: fileName,
      status: 'completed',
      totalPages: imagesToProcess.length,
      processedPages: imagesToProcess.length,
      progressMessage: '完了'
    });

    return { success: true, items: allItems };

  } catch (error) {
    Logger.log('Error processing file: ' + error.toString());

    saveJob({
      id: jobId,
      fileName: fileName,
      status: 'error',
      totalPages: 0,
      processedPages: 0,
      progressMessage: error.toString()
    });

    return { success: false, error: error.toString() };
  }
}

/**
 * アイテムを更新
 */
function updateItem(itemId, updates) {
  const ss = getOrCreateStorageSheet();
  const sheet = ss.getSheetByName('Items');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === itemId) {
      // 更新処理（必要なフィールドのみ）
      if (updates.productName !== undefined) data[i][3] = updates.productName;
      if (updates.size !== undefined) data[i][6] = updates.size;
      if (updates.color !== undefined) data[i][7] = updates.color;
      if (updates.isVerified !== undefined) data[i][11] = updates.isVerified;
      if (updates.distributions !== undefined) {
        data[i][13] = JSON.stringify(updates.distributions);
        // 合計再計算
        const total = updates.distributions.reduce((sum, d) => sum + d.quantity, 0);
        data[i][9] = total;
        data[i][10] = total === data[i][8];
      }

      sheet.getRange(i + 1, 1, 1, 14).setValues([data[i]]);
      return { success: true };
    }
  }

  return { success: false, error: 'Item not found' };
}
