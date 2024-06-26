---
title: "ポッドキャストプラットフォームのSEO対策(特にSpotify、Apple Podcast)"
description: "ポッドキャストのSEOについて調査してみました。調査結果をもとに番組タイトルなどを少し変えてみたら効果があったので、読む価値アリ！"
pubDate: "Apr 21 2024"
heroImage: "/blog/seo-podcast/thumbnail.png"
author: "おぐらくん"
---

Google検索のSEOについて言及している記事やポッドキャストは見つかるのですが、
ポッドキャストプラットフォーム(Spotify, Apple Podcast)内でのSEOについての記事は見当たらなかったので、調査してまとめました。

## Spotify

Spotifyは、プラットフォーム内のSEOについて自社でまとめてくれているページがあります。

https://podcasters.spotify.com/resources/learn/grow/podcast-seo

このページに掲載されているスライドがとても分かりやすかったです。

![SpotifyのSEOスライド](/blog/seo-podcast/spotify-slide.png)

ざっとまとめると、検索で考慮されるのは以下の4項目。

- チャンネルとエピソードのタイトル
- 公開者の名前
- チャンネルとエピソードの説明文
- 「検索の成功」

「検索の成功」というのは、実際に検索結果に表示された時のクリック率や再生率などのことを指しているようです。

また、明確なタイトルと明確で質の良い説明文を書くことが推奨されています。

逆に、以下のようなことは非推奨です。

- 特集なスペリングや特殊文字、造語の使用
- 短すぎるエピソードの説明文
- 同じ文章の繰り返し
- 一般的なワードや被りやすい名前の使用

一般的に使われていない言葉を使うとそもそも検索にヒットしにくいと言うことですが、
被りやすい単語だけを使っていると、既存の人気番組に埋もれてしまうということらしい。

（そのバランスが難しいよ・・・

### ちなみに: Spotifyのレコメンドアルゴリズムについて

直接的に説明してるページは見つからなかったのですが、
他のページを参考に推測すると、基本的には中身とユーザーエンゲージメントの高さで評価されているっぽいです。

https://podcasters.spotify.com/resources/learn/grow/how-to-use-spotifys-listening-features-to-grow-your-show

この中で、Spotify特有の機能のためにチャプターの設定などを推奨しています。
なんとなく、ホームでスワイプしてレコメンドされるデータの抽出に使われそうな気も・・・。

機能が変わっても、情報として評価されそうなので、やっておいて損はなさそうです。

## Apple Podcast

Apple Podcastも、プラットフォーム内のSEOについて自社でまとめてくれているページがあります。
(Spotifyより情報が少なく、英語しかないっぽいですが)

https://podcasters.apple.com/support/3686-search-on-apple-podcasts

まとめると、検索で考慮されるのは以下の3項目

- メタデータ
  - チャンネルのタイトル、チャンネルの名前、放送のタイトル
- 人気度
  - フォロワーの数と再生数
- ユーザーの行動
  - エンゲージメントの高さ(検索結果から再生やフォローされた割合など)

Apple Podcastは、検索結果における人気度の重みが大きいようで、
一定数再生されないと検索結果に出てこないっぽいです。

それもあってか、番組を公開したら宣伝することを推奨しています。

直近の更新頻度などはそこまで重視されていなさそうなので、
Spotifyと比べると新しいポッドキャスト番組には不利な戦場かもしれません。

番組タイトルの注意点はSpotifyとだいたい同じなのですが
注意点として、Spotify と違って番組の説明文は検索結果のアルゴリズムで考慮されないとのことです。

つまり、Apple Podcastで検索結果の上位に表示したいキーワードがある場合は、
番組やエピソードの説明文ではなく、タイトルに入れる必要があるってことですね！

### ちなみに: ITトリオの日常の例

「ITトリオの日常」は、2023年12月まではタイトルに「エンジニア」と含まれていなかったので、
Apple Podcastで「エンジニア」と検索してもかなり下の方に表示されていました。

2024年の1月に、

「ITトリオの日常 \~エンジニア3人がカジュアルに学びを深めるラジオ\~」

と変更したところ、数ヶ月経ってから検索結果の上位に表示されるようになりました。やったね！

### ちなみに: Apple Podcastにおける検索ワードのレコメンドについて

検索ワードのレコメンドは検索結果とは違い、
チャンネルのタイトルと前方一致したものが優先的に表示される様子です。
(日本のApple Podcastに限る)

例えば「エンジニア」と打ち込んだときの検索ワードのレコメンドは以下のようになりますが

![「エンジニア」と打ち込んだときの検索ワードのレコメンド](/blog/seo-podcast/word-engineer.jpeg)

「エンジニア」の検索結果は以下のようになり、検索ワードのレコメンドとは結果の順番が違うことが分かります。

![「エンジニア」の検索結果](/blog/seo-podcast/result-engineer.jpeg)

どうやらこの検索ワードのレコメンドについては人気度の重みが小さそうなので、
新しく番組を始める際には、先頭一致で表示したいキーワードを意識すると良いかもしれません。

ちなみにITトリオの日常は、「IT」の検索ワードのレコメンドで二番目に表示されています。

![「IT」の検索ワードのレコメンド](/blog/seo-podcast/word-it.jpeg)

(番組開始時に意識してたわけではないので、運が良かったなぁ〜！

余談ですがこの

「タイトルは考慮されるが説明文は考慮されない」

という仕様が、App Storeの評価基準と同じです。

アップルは文章の解析をあんまりやりたくないんですかね・・・？


## Google Podcast / Youtube

Google Podcast / Youtube については、情報が見当たりませんでした。

ただ、既存のYouTube アルゴリズムが参考になるだろうと思います。

YouTubeのアルゴリズムは通常動画とshorts で違ったりしますが、
基本的にはユーザーエンゲージメントが大切なので、
タップ率や視聴維持率、完全視聴率などが重視されそうな気がします。

それらを踏まえると、ポッドキャストの場合でも質の良い放送を作ってユーザーエンゲージメントを高めることが大事なのかなと思います。

## 番外編:webサイト

公式サイトがあると、Googleのボットがポッドキャストの価値を評価しやすくなるので大事ですし、
そもそもGoogleでの検索数が大きいので、ポッドキャストの認知度を上げるなら公式サイトを作って損はないです。

色々調べてみましたが

- https://castos.com/seo-for-podcasts/
- https://rss.com/blog/how-to-optimize-your-podcast-episodes/
- https://www.ranktracker.com/ja/blog/10-ways-to-optimize-your-podcast-with-proper-seo/
- https://podcasts.apple.com/ca/podcast/podcast-seo-best-practices-how-to-optimize-your-podcast/id1489907979?i=1000579349147

ポッドキャストだからと言って特別なSEO対策は必要なさそうで、
一般的なWebサイトのベストプラクティスにのっとる(タイトルやキーワードやOGP)ことが大事っぽいですね〜。
