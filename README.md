<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 汎用 AI OCR システム - Gemini Powered

あらゆる文書をAIで自動デジタル化する、カスタマイズ可能なOCRアプリケーションです。

Gemini 3.0 APIを使用して、ユーザー定義のテンプレートに基づいてデータを抽出・構造化します。

## ✨ 特徴

- 🎯 **完全カスタマイズ可能**: 抽出したいフィールドを自由に定義
- 📝 **テンプレート管理**: 複数のテンプレートを保存・再利用
- 🔄 **インポート/エクスポート**: テンプレートをJSON形式で共有
- 🤖 **AI自動抽出**: Gemini 3.0が文書を解析してデータ化
- 📊 **動的テーブル**: テンプレートに応じた表示を自動生成
- 💾 **データ永続化**: IndexedDBでブラウザに保存

## 🚀 セットアップ

**Prerequisites:** Node.js

1. 依存関係のインストール:
   ```bash
   npm install
   ```

2. Gemini API Keyの設定:

   `.env.local` ファイルを作成し、以下を追加:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

   APIキーは [Google AI Studio](https://aistudio.google.com/app/apikey) で取得できます。

3. アプリの起動:
   ```bash
   npm run dev
   ```

4. ブラウザで `http://localhost:3000` にアクセス

## 📋 主要機能

### テンプレート作成
- フィールド名、型（string/number/boolean/array/object）、説明を定義
- 必須/オプション設定
- ネストされた構造（配列内オブジェクト等）に対応

### OCR処理
- PDF/画像ファイルをアップロード
- テンプレートに基づいて自動的にデータ抽出
- 動的に生成されたテーブルで結果を表示

### データ管理
- インライン編集
- CSV エクスポート（テンプレートに準拠）
- テンプレートのインポート/エクスポート（JSON形式）
- データ永続化（IndexedDB）

## 🎯 使用例

### 📄 請求書処理
請求書番号、日付、顧客名、明細、金額などを抽出

### 🧾 領収書処理
発行日、店舗名、購入品目、金額などを抽出

### 💼 名刺管理
氏名、会社名、部署、役職、連絡先などを抽出

### 📋 カスタムフォーム
任意の帳票に対応したフィールドを定義可能

## 🛠️ 技術スタック

- **フロントエンド**: React 19 + TypeScript
- **ビルドツール**: Vite
- **AI**: Google Gemini 3.0 API
- **PDF処理**: PDF.js
- **データベース**: IndexedDB (idb)
- **UI**: Tailwind CSS + Lucide Icons

## 📦 プロジェクト構造

```
.
├── DynamicApp.tsx              # メインアプリケーション
├── dynamicTypes.ts             # 型定義
├── components/
│   ├── DynamicResultTable.tsx  # 動的テーブル表示
│   ├── TemplateSelector.tsx    # テンプレート選択UI
│   ├── Dropzone.tsx           # ファイルアップロード
│   └── JobStatus.tsx          # 処理状況表示
├── services/
│   ├── dynamicGeminiService.ts # Gemini API呼び出し
│   ├── templateService.ts      # テンプレート管理
│   └── pdfService.ts          # PDF処理
└── utils/
    ├── schemaGenerator.ts      # スキーマ生成
    └── dynamicCsvHelper.ts    # CSV出力
```

## 🔧 カスタマイズ

### テンプレートの作成

テンプレートはJSON形式で定義します。例：

```json
{
  "id": "my-template",
  "name": "マイテンプレート",
  "description": "説明",
  "fields": [
    {
      "id": "field1",
      "name": "field1",
      "label": "フィールド1",
      "type": "string",
      "description": "AIへの抽出指示",
      "required": true
    }
  ]
}
```

## 📄 ライセンス

このプロジェクトはオープンソースです。

## 🙏 クレジット

Powered by [Google Gemini 3.0](https://ai.google.dev/)
