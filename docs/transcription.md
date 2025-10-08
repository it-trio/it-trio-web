# 文字起こし機能

このドキュメントでは、エピソードページに文字起こしを追加する機能について説明します。

## 概要

この機能は、ポッドキャストエピソードの音声を自動的に文字起こしし、話者を識別してエピソードページに表示します。

## 使用しているサービス

**AssemblyAI**を使用しています。AssemblyAIは以下の理由で選択されました：

- 高品質な日本語音声認識
- 話者識別（Speaker Diarization）機能
- 品質と価格のバランスが良い
- APIが使いやすい

## セットアップ

### 必要な環境変数

GitHub Secretsに以下を設定してください：

- `ASSEMBLYAI_API_KEY`: AssemblyAIのAPIキー

### APIキーの取得

1. [AssemblyAI](https://www.assemblyai.com/)にアクセス
2. アカウントを作成
3. ダッシュボードからAPIキーを取得
4. GitHub リポジトリの Settings > Secrets and variables > Actions でシークレットを追加

## 使い方

### GitHubアクションから実行

1. GitHubリポジトリのActionsタブに移動
2. "Transcribe Episode"ワークフローを選択
3. "Run workflow"をクリック
4. エピソード番号を入力（例: `18`）
5. "Run workflow"を実行

ワークフローが完了すると、文字起こしを含むPRが自動的に作成されます。

### ローカルで実行

```bash
# 環境変数を設定
export ASSEMBLYAI_API_KEY="your-api-key"

# エピソード番号を指定して実行
pnpm run transcribe 18
```

## ファイル構成

### スクリプト

- `scripts/transcribe.cjs`: 文字起こしを実行するメインスクリプト

### ワークフロー

- `.github/workflows/transcribe.yml`: 文字起こしを実行するGitHub Actionsワークフロー

### コンテンツ

- `src/content/transcription/`: 文字起こしデータを保存するディレクトリ
  - 各エピソードのGUIDをファイル名として保存（例: `0a775d4e-d12f-426f-8005-6c79b3c1c71b.json`）

### UIコンポーネント

- `src/components/Transcription.astro`: 文字起こしを表示するコンポーネント
- `src/layouts/EpisodePost.astro`: エピソードページのレイアウト（文字起こしセクションを含む）

## データフォーマット

文字起こしデータは以下の形式で保存されます：

```json
{
  "segments": [
    {
      "speaker": "Speaker A",
      "text": "話した内容のテキスト",
      "timestamp": "00:00:05",
      "start": 5000,
      "end": 12000
    }
  ],
  "language": "ja"
}
```

## 表示

エピソードページの説明欄の下に、文字起こしセクションが表示されます：

- デフォルトで閉じた状態
- クリックで開閉可能
- 話者名、タイムスタンプ、発言内容を表示

## トラブルシューティング

### エラー: "Episode not found"

指定したエピソード番号が存在しない可能性があります。`src/content/episode/`ディレクトリを確認してください。

### エラー: "ASSEMBLYAI_API_KEY is not set"

環境変数またはGitHub Secretsが正しく設定されているか確認してください。

### 文字起こしの精度が低い

AssemblyAIは日本語に対応していますが、以下の要因で精度が変わる可能性があります：

- 音声の品質
- 話者の発音
- バックグラウンドノイズ

必要に応じて、`scripts/transcribe.cjs`のパラメータを調整してください。

## コスト

AssemblyAIの料金体系：

- 音声認識: $0.00025/秒（約$0.015/分）
- 話者識別: 追加料金なし

30分のエピソードの場合、約$0.45のコストがかかります。

詳細は[AssemblyAIの料金ページ](https://www.assemblyai.com/pricing)を参照してください。
