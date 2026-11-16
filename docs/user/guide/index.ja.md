<a id="use-the-web-ui"></a>

# Web UI を使う

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | 日本語 | [Español](index.es.md) | [Français](index.fr.md) | [Deutsch](index.de.md) | [Português](index.pt.md) | [한국어](index.ko.md)
<!-- USER_LANGUAGES_END -->

[ルート README](../../development.md) の手順で Web UI を起動すると、コマンドが URL を表示します。このガイドは、そのサーバーの起動後から始まります。`dsh` プロセスは呼び出し元のディレクトリを既定のファイルシステムの場所として使用しますが、初回の Web UI では、追加するまでワークスペースは選択されていません。

<a id="configure-a-model"></a>

## モデルを設定する

**設定 → モデル**を開いてモデルプロバイダーを選びます。[モデル設定ガイド](./providers.ja.md)では、対応プロバイダーとカスタムの OpenAI 互換エンドポイントを説明しています。DeepSeek の経路では、[DeepSeek API キー](https://platform.deepseek.com/)を入力して保存してください。サーバーを再起動せずに、そのモデル経路をすぐに利用できます。

<a id="choose-a-workspace"></a>

## ワークスペースを選ぶ

**ワークスペースを選択**をクリックし、`dsh` を起動したプロジェクトディレクトリを追加して選択します。ワークスペースを選ぶまで、セッションの入力欄は利用できません。

<a id="run-a-task"></a>

## タスクを実行する

セッションを開始し、次のメッセージを送信します：

> このリポジトリを要約し、主要なパッケージを特定して。

エージェントは、ワークスペース内のファイルの読み書き、コマンドの実行、作業の委任、計画の管理を行えます。有効な権限ポリシーで承認が必要な操作については、Web UI が実行前に確認します。

<a id="continue"></a>

## 次のステップ

- [モデルを設定する](./providers.ja.md)
- [ネットワークプロキシを設定する](./network-proxy.ja.md)
- [MCP メモリを使う](./mcp-memory.ja.md)
- [リマインダーを設定する](./schedule.ja.md)
- [Python SDK を使う](./python-sdk.ja.md)
- [リバースプロキシの背後で Web UI を公開する](./public-deployments.ja.md)
- [Ocean Desktop をアンインストールする](./desktop-uninstall-cleanup.ja.md)
- [ほかの CLI モードを使う](../../../apps/cli/README.md)
- [プラグインを開発する](../develop/basic/index.md)
