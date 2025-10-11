# エピソード文字起こし機能

このドキュメントでは、エピソードに文字起こしを追加する方法について説明します。

## 概要

この機能は、エピソードの音声を自動的に文字起こしし、話者識別とタイムスタンプ付きでエピソードページに表示します。

## 使用しているサービス

文字起こしには [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text) を使用しています。OpenAI Whisper APIは以下の理由で選ばれました：

- **優れた日本語認識精度** - 日本語の文字起こし品質が非常に高い
- **高速処理** - AssemblyAIと比較して高速に処理が完了
- **コストパフォーマンス** - 品質と価格のバランスが良い
- **シンプルなAPI** - 実装が容易

### AssemblyAIからの移行

以前はAssemblyAIを使用していましたが、日本語の文字起こし精度が十分ではなかったため、OpenAI Whisper APIに移行しました。Whisperは日本語を含む多言語に対応した高精度な音声認識モデルです。

## セットアップ

### 1. OpenAI APIキーの取得

1. [OpenAI Platform](https://platform.openai.com/) にアクセス
2. アカウントを作成またはログイン
3. API Keys セクションからAPIキーを生成

### 2. GitHub Secretsの設定

1. GitHubリポジトリの Settings > Secrets and variables > Actions に移動
2. `OPENAI_API_KEY` という名前でシークレットを追加
3. 取得したAPIキーを値として設定

**注意**: 既存の `ASSEMBLYAI_API_KEY` シークレットは不要になりますが、削除は任意です。

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
# 依存関係をインストール（初回のみ）
pnpm install

# 環境変数を設定
export OPENAI_API_KEY=your_api_key_here

# スクリプトを実行
pnpm run transcribe 18
```

または直接：

```bash
OPENAI_API_KEY=your_api_key_here node scripts/transcribe.cjs 18
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
      "speaker": "A",
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

## 話者識別（Speaker Diarization）について

現在の実装では、基本的なヒューリスティックを使用した話者識別を行っています：

- セグメント間の無音時間（2秒以上）を基準に話者の切り替えを判断
- 話者は A、B、C としてラベル付け
- 必要に応じて手動で修正することを推奨

### 話者識別の改善案

より高度な話者識別を実現するには、以下のサービスの利用を検討できます：

- [Pyannote.audio](https://github.com/pyannote/pyannote-audio) - オープンソースの話者識別ツール
- [AssemblyAI](https://www.assemblyai.com/) - 話者識別に特化した機能を提供

## トラブルシューティング

### 文字起こしが失敗する場合

1. APIキーが正しく設定されているか確認
2. エピソード番号が正しいか確認
3. 音声ファイルURLにアクセスできるか確認
4. OpenAI APIの利用制限に達していないか確認

### 文字起こしが表示されない場合

1. 文字起こしファイルが作成されているか確認（`src/content/transcription/`）
2. ファイル名がエピソードのGUIDと一致しているか確認
3. ビルドエラーがないか確認（`pnpm build`）

### 文字起こしの品質が低い場合

1. 音声ファイルの品質を確認（ノイズが多い場合は品質が低下する可能性があります）
2. 話者識別が正しくない場合は、手動で修正してください

## コスト

OpenAI Whisper APIの料金は音声の長さに基づきます：

- 料金: $0.006 / 分
- 例: 60分のエピソード = $0.36

最新の料金情報は[OpenAI Pricing](https://openai.com/pricing)を確認してください。

## 今後の改善案

- 複数エピソードの一括文字起こし
- より高度な話者識別（pyannote.audioなどの統合）
- 話者名のカスタマイズ機能
- 文字起こしの編集機能
- 検索機能の追加
- 文字起こしの自動校正機能
