<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 北海道三喜社 FAX OCR - Gemini Powered

FAX注文書（配送ピッキングリスト）をAIで自動デジタル化するWebアプリケーションです。

Gemini 3.0 APIを使用して、スキャンされた注文書から商品データを抽出・検証します。

## 🚀 デプロイ方法

このアプリケーションは2つの環境で動作します：

### 1️⃣ ローカル環境（Vite + React）

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   ```bash
   npm run dev
   ```

**AI Studio**: https://ai.studio/apps/drive/1TQO41j_1oKkfsBbNrXTJg7KysD7NRCDJ

### 2️⃣ Google Apps Script環境

サーバーレスでGAS環境にデプロイできます。

📁 **[GAS版のREADME を見る →](./gas/README_GAS.md)**

**特徴:**
- サーバーレス（GASのインフラで動作）
- Google Sheetsでデータ永続化
- 無料で利用可能（Gemini API利用料のみ）
- 承認プロセス不要のWebアプリ

## 📋 主要機能

- ✅ FAX注文書の自動OCR処理
- ✅ データクリーニングと自動補正
- ✅ 数量照合と検証
- ✅ インライン編集
- ✅ CSV エクスポート
- ✅ ページ単位での再スキャン
- ✅ データ永続化（IndexedDB / Google Sheets）

## 📚 ドキュメント

- [ローカル環境セットアップ](./README.md)
- [Google Apps Script版セットアップ](./gas/README_GAS.md)
