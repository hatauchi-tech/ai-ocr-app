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
- 💾 **データ永続化**: ブラウザまたはGoogle Sheetsに保存

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

- ✅ ユーザー定義フィールドによるOCR処理
- ✅ テンプレート作成・保存・管理
- ✅ 動的スキーマ生成とプロンプト最適化
- ✅ インライン編集
- ✅ CSV エクスポート（テンプレートに準拠）
- ✅ テンプレートのインポート/エクスポート
- ✅ データ永続化（IndexedDB / Google Sheets）

## 🎯 使用例

### 請求書処理
請求書番号、日付、顧客名、明細、金額などを抽出

### 領収書処理
発行日、店舗名、購入品目、金額などを抽出

### 名刺管理
氏名、会社名、部署、役職、連絡先などを抽出

### カスタムフォーム
任意の帳票に対応したフィールドを定義

## 📚 ドキュメント

- [ローカル環境セットアップ](./README.md)
- [Google Apps Script版セットアップ](./gas/README_GAS.md)
