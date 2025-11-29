# 北海道三喜社 FAX OCR - Google Apps Script版

このディレクトリには、Google Apps Script (GAS) 環境で動作するバージョンのFAX OCRアプリケーションが含まれています。

## 📋 概要

GAS版では、以下の特徴があります：

- **サーバーレス**: GASのクラウドインフラで動作
- **データ永続化**: Google Sheetsをデータベースとして使用
- **Gemini API統合**: GAS側でAPIを呼び出し
- **Webアプリ**: HTML ServiceでReactアプリを提供

## 🚀 デプロイ手順

### 方法1: GASエディタで直接作成（推奨）

1. **新しいGASプロジェクトを作成**
   - https://script.google.com/ にアクセス
   - 「新しいプロジェクト」をクリック
   - プロジェクト名を「Hokkaido Sanki FAX OCR」に変更

2. **ファイルをアップロード**
   - デフォルトの `Code.gs` を削除
   - `+` ボタンから「スクリプト」を選択して `Code.gs` を作成
   - `gas/Code.gs` の内容をコピー&ペースト
   - `+` ボタンから「HTML」を選択して `Index.html` を作成
   - `gas/Index.html` の内容をコピー&ペースト
   - プロジェクト設定（歯車アイコン）から「appsscript.json をエディタで表示」をオン
   - `appsscript.json` に `gas/appsscript.json` の内容をコピー&ペースト

3. **Gemini API Keyを設定**
   - プロジェクト設定（歯車アイコン）をクリック
   - 「スクリプト プロパティ」セクションに移動
   - 「スクリプト プロパティを追加」をクリック
   - プロパティ: `GEMINI_API_KEY`
   - 値: あなたのGemini API Key（https://aistudio.google.com/app/apikey で取得）

4. **デプロイ**
   - 右上の「デプロイ」→「新しいデプロイ」をクリック
   - 「種類の選択」→「ウェブアプリ」を選択
   - 説明: `v1.0` など
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**（または組織内のユーザーのみ）
   - 「デプロイ」をクリック
   - 承認プロセスを完了（初回のみ）
   - デプロイされたURLをコピー

5. **アプリにアクセス**
   - デプロイURLにアクセスしてアプリを使用

### 方法2: clasp CLIツールを使用（上級者向け）

1. **claspのインストール**
   ```bash
   npm install -g @google/clasp
   ```

2. **Googleアカウントでログイン**
   ```bash
   clasp login
   ```

3. **新しいGASプロジェクトを作成**
   ```bash
   cd gas
   clasp create --type webapp --title "Hokkaido Sanki FAX OCR"
   ```

4. **`.clasp.json` が自動生成されます**
   - Script IDが記載されています

5. **コードをプッシュ**
   ```bash
   clasp push
   ```

6. **スクリプトプロパティを設定**
   - https://script.google.com/ でプロジェクトを開く
   - プロジェクト設定 → スクリプト プロパティ
   - `GEMINI_API_KEY` を追加

7. **デプロイ**
   ```bash
   clasp deploy --description "v1.0"
   ```

8. **デプロイされたURLを取得**
   ```bash
   clasp deployments
   ```

## ⚙️ 設定

### 必須設定

| 設定項目 | 説明 |
|---------|------|
| `GEMINI_API_KEY` | Gemini APIキー（スクリプトプロパティに設定） |

### オプション設定

| 設定項目 | 説明 | デフォルト |
|---------|------|----------|
| `STORAGE_SHEET_ID` | データ保存用スプレッドシートID（自動生成） | 自動作成 |

## 📊 データ構造

### Google Sheets構造

データは自動的に作成されるスプレッドシート「Hokkaido Sanki OCR Data」に保存されます。

#### Jobsシート
| 列 | 内容 |
|----|------|
| A | Job ID |
| B | ファイル名 |
| C | ステータス |
| D | 総ページ数 |
| E | 処理済みページ数 |
| F | メッセージ |

#### Itemsシート
| 列 | 内容 |
|----|------|
| A | Item ID |
| B | Job ID |
| C | No |
| D | 商品名 |
| E | JANコード |
| F | メーカー品番 |
| G | サイズ |
| H | カラー |
| I | 記載合計 |
| J | 算出合計 |
| K | 一致フラグ |
| L | 確認済みフラグ |
| M | ページ番号 |
| N | 配送内訳（JSON） |

## 🔧 カスタマイズ

### 並行処理数の変更

`Code.gs` の以下の行を編集：

```javascript
const CONCURRENCY_LIMIT = 3; // 同時処理数（1-10推奨）
```

### タイムゾーンの変更

`appsscript.json` の以下の行を編集：

```json
"timeZone": "Asia/Tokyo"
```

## 🚨 制限事項

### GASの制限

- **実行時間**: 最大6分（無料アカウント）、30分（Google Workspace）
- **URLFetch**: 1日20,000リクエスト
- **ファイルサイズ**: 最大50MB
- **同時実行**: 30実行/ユーザー

### 本実装の制限

- **PDF処理**: 現在PDFは1ページとして処理されます（複数ページPDFの分割は未実装）
- **画像保存**: 画像データは保存されません（セッション内のみ）
- **検証ビュー**: 簡易版のみ実装（詳細な画像プレビューなし）

## 🔐 セキュリティ

- Gemini API Keyはスクリプトプロパティに保存され、暗号化されます
- データはGoogle Sheetsに保存され、Googleアカウントで保護されます
- Webアプリのアクセス権限を適切に設定してください

## 🐛 トラブルシューティング

### APIエラーが発生する

- スクリプトプロパティに `GEMINI_API_KEY` が正しく設定されているか確認
- Gemini API Keyが有効か確認
- APIの使用量制限を超えていないか確認

### 「承認が必要です」と表示される

- 初回実行時は承認プロセスが必要です
- 「詳細」→「安全ではないページに移動」をクリック
- 必要な権限を承認

### データが保存されない

- スプレッドシートが正しく作成されているか確認
- スクリプトプロパティの `STORAGE_SHEET_ID` を確認
- スプレッドシートへのアクセス権限を確認

### 処理が遅い

- `CONCURRENCY_LIMIT` を増やす（推奨: 3-5）
- 画像サイズを小さくする
- 一度に処理するファイル数を減らす

## 📝 更新方法

### GASエディタで更新

1. https://script.google.com/ でプロジェクトを開く
2. コードを編集
3. 保存（Ctrl+S / Cmd+S）
4. 新しいバージョンをデプロイ

### claspで更新

```bash
cd gas
# コードを編集後
clasp push
clasp deploy --description "v1.1"
```

## 📚 参考リンク

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [clasp - Apps Script CLI](https://github.com/google/clasp)

## 💡 Tips

### パフォーマンス改善

- 画像サイズを最適化してからアップロード
- 大量のファイルは分割して処理
- ピーク時を避けて処理

### コスト削減

- 不要なデータは定期的に削除
- API呼び出し回数を最小限に
- キャッシュを活用（将来の拡張）

## 🎯 今後の改善予定

- [ ] 複数ページPDFの完全サポート
- [ ] 画像データの永続化（Google Drive）
- [ ] バッチ処理の最適化
- [ ] エラーハンドリングの強化
- [ ] 詳細な検証ビューの実装
- [ ] パフォーマンスモニタリング

---

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
