# Ocean

<!-- USER_LANGUAGES_START -->
[English](README.md) | [中文](README.zh.md) | [Русский](README.ru.md) | 日本語 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [한국어](README.ko.md)
<!-- USER_LANGUAGES_END -->

Ocean は、AI エージェント、会話、ツールのためのデスクトップワークスペースです。プラグインベースのランタイムが、モデルプロバイダー、開発ツール、任意のブラウザ・コンピューター操作機能を接続します。

<a id="developer-preview"></a>

## 開発者プレビュー

Ocean は活発に開発中です。API や機能は変更される場合があります。実行前に[安全上の注意](SAFETY.md)をお読みください。ローカルでビルドに成功しても、セキュリティ監査を受けたことや、署名済みの公開リリースであることを意味しません。

<a id="get-started"></a>

## はじめに

このリポジトリを使用してください：[Ryltsevmg/Ocean](https://github.com/Ryltsevmg/Ocean)。公開リリースの準備中はアクセスが制限される場合があります。上流のインストーラーや未検証の npm パッケージを、Ocean のインストール方法として使わないでください。

ソースからのセットアップとローカルの Web/Desktop コマンドは、[開発ガイド](docs/development.md)に従ってください。要件とコマンドの定義は [package.json](package.json) で管理されています。新しいビルドを試す前に、既存のプロファイルをバックアップしてください。

<a id="documentation"></a>

## ドキュメント

- [ユーザーガイド](docs/user/index.ja.md)
- [アーキテクチャ](docs/architecture.md)
- [貢献方法](CONTRIBUTING.md)
- [安全性](SAFETY.md)
- [ブランドガイドライン](docs/brand-guidelines.md)

[GitHub Actions](.github/workflows/) の検証ワークフローは、この設定の公開後、プルリクエストと main へのプッシュ時に実行されます。Linux のパッケージ作成は手動です。現在のパッケージ作成では未署名の成果物が生成されます。これは自動更新チャネルではありません。

<a id="feedback"></a>

## フィードバック

再現可能な不具合は、リポジトリにアクセスできる場合は [Ocean issues](https://github.com/Ryltsevmg/Ocean/issues) に報告するか、[Ocean サポート](mailto:support@oceanharness.com)にご連絡ください。[Telegram サポートボット](https://t.me/oceanchatsupportbot)も利用できます。トークン、非公開のセッションログ、個人情報を公開の issue に投稿しないでください。

<a id="license-and-acknowledgements"></a>

## ライセンスと謝辞

[MIT](LICENSE)。ソースの出自、保持されている著作権表示、依存関係の利用条件は、[サードパーティーに関する通知](THIRD_PARTY_NOTICES.md)に記載されています。
