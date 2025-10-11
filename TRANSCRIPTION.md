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

## 話者名の変更

文字起こしが完了した後、PRのコメントで話者名を一括変更できます。

### 使い方

1. 文字起こしのPRが作成されたら、そのPRにコメントを投稿します
2. コメントの形式：
   ```
   speaker おぐらくん ちーず なべちゃん
   ```
3. GitHub Actionが自動的に実行され、以下のように置換されます：
   - Speaker A → おぐらくん
   - Speaker B → ちーず
   - Speaker C → なべちゃん

### 仕組み

- `speaker` で始まるコメントを検出
- スペース区切りで話者名を取得
- PR内のすべての文字起こしJSONファイルを更新
- 変更を自動的にコミット＆プッシュ
- 完了後、コメントで結果を通知

### 例

PRに以下のようにコメント：
```
speaker おぐらくん ちーず なべちゃん
```

すると、JSONファイル内の：
```json
{
  "speaker": "A",
  "text": "こんにちは"
}
```

が以下のように更新されます：
```json
{
  "speaker": "おぐらくん",
  "text": "こんにちは"
}
```

### 関連ファイル

- `.github/workflows/update-speaker-names.yml` - PRコメントに反応するワークフロー
- `scripts/update-speakers.cjs` - 話者名を更新するスクリプト

## 今後の改善案

- 複数エピソードの一括文字起こし
- 文字起こしの編集機能
- 検索機能の追加
