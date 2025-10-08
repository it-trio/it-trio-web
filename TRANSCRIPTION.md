# エピソード文字起こし機能

このドキュメントでは、エピソードに文字起こしを追加する方法について説明します。

## 概要

この機能は、エピソードの音声を自動的に文字起こしし、話者識別とタイムスタンプ付きでエピソードページに表示します。

## 使用しているサービス

文字起こしには [AssemblyAI](https://www.assemblyai.com/) を使用しています。AssemblyAIは以下の理由で選ばれました：

- 高品質な話者識別（Speaker Diarization）
- 日本語対応
- 品質と価格のバランスが良い
- シンプルなAPI

## セットアップ

### 1. AssemblyAI APIキーの取得

1. [AssemblyAI](https://www.assemblyai.com/) にアクセス
2. アカウントを作成
3. ダッシュボードからAPIキーを取得

### 2. GitHub Secretsの設定

1. GitHubリポジトリの Settings > Secrets and variables > Actions に移動
2. `ASSEMBLYAI_API_KEY` という名前でシークレットを追加
3. 取得したAPIキーを値として設定

## 使い方

### GitHub Actionsから実行（推奨）

1. GitHubリポジトリの「Actions」タブに移動
2. 「Transcribe Episode」ワークフローを選択
3. 「Run workflow」をクリック
4. エピソード番号を入力（例: `18`）
5. 「Run workflow」をクリック

ワークフローが完了すると、自動的にPRが作成されます。

### ローカルで実行

```bash
# 環境変数を設定
export ASSEMBLYAI_API_KEY=your_api_key_here

# スクリプトを実行
pnpm run transcribe 18
```

または直接：

```bash
ASSEMBLYAI_API_KEY=your_api_key_here node scripts/transcribe.cjs 18
```

## ファイル構造

### スクリプト

- `scripts/transcribe.cjs` - 文字起こしスクリプト

### ワークフロー

- `.github/workflows/transcribe.yml` - GitHub Actionsワークフロー

### 文字起こしデータ

- `src/content/transcription/{guid}.json` - エピソードごとの文字起こしデータ

例：
```json
{
  "segments": [
    {
      "speaker": "Speaker A",
      "text": "こんにちは！",
      "timestamp": "00:00:05",
      "start": 5000,
      "end": 12000
    }
  ],
  "language": "ja"
}
```

### UI コンポーネント

- `src/components/Transcription.astro` - 文字起こし表示コンポーネント
- `src/layouts/EpisodePost.astro` - エピソードページレイアウト（文字起こしセクションを含む）

## UIの特徴

- 開閉可能なセクション（デフォルトは閉じている）
- 話者名とタイムスタンプ付きで表示
- モバイル対応のレスポンシブデザイン

## トラブルシューティング

### 文字起こしが失敗する場合

1. APIキーが正しく設定されているか確認
2. エピソード番号が正しいか確認
3. 音声ファイルURLにアクセスできるか確認

### 文字起こしが表示されない場合

1. 文字起こしファイルが作成されているか確認（`src/content/transcription/`）
2. ファイル名がエピソードのGUIDと一致しているか確認
3. ビルドエラーがないか確認（`pnpm build`）

## コスト

AssemblyAIの料金は音声の長さに基づきます。最新の料金情報は[AssemblyAIの料金ページ](https://www.assemblyai.com/pricing)を確認してください。

## 今後の改善案

- 複数エピソードの一括文字起こし
- 話者名のカスタマイズ
- 文字起こしの編集機能
- 検索機能の追加
