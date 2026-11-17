<a id="connect-a-third-party-memory-mcp-server"></a>

# サードパーティーのメモリー MCP サーバーを接続する

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | 日本語 | [Español](mcp-memory.es.md) | [Français](mcp-memory.fr.md) | [Deutsch](mcp-memory.de.md) | [Português](mcp-memory.pt.md) | [한국어](mcp-memory.ko.md)
<!-- USER_LANGUAGES_END -->

ここで紹介する 3 つの**既定で無効な参照設定**は、[`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md) を通じて、いずれかのメモリーシステムを OCEAN に接続します。1 つ選ぶか、同じ汎用 MCP 行をコピーして別のサーバーに使用してください。

これらのサードパーティー設定は、相互運用性の例としてのみ提供されています。掲載は、Ocean プロジェクトによる支持、推奨、提携、継続的なサポートを意味しません。

<a id="what-ocean-does"></a>

## OCEAN が行うこと

OCEAN は選択された Cordis オーバーレイを解析し、設定された stdio コマンドを起動するか、設定された Streamable HTTP URL に接続して、MCP ツールを検出し、`mcp__<serverName>__<tool>` として公開します。OCEAN は、サーバーのダウンロード、データベースの初期化、モデルや埋め込みプロバイダーの選択、クラウドアカウントの作成、ベンダーデータの移行、別の HTTP サービスの監視を**行いません**。stdio では、汎用クライアントが OCEAN プラグインのライフサイクルに合わせて子プロセスを起動・停止します。HTTP では、上流サービスがあらかじめ動作している必要があります。

stdio ブリッジは子プロセスの起動前に、通常は認証情報を表す名前の環境変数と、すべての `OCEAN_*` 変数を意図的に取り除きます。それ以外の環境変数は引き継がれます。各例では、必要な最小限の上書き設定だけを追加しています。上流のオプション機能で別の秘密情報が必要な場合は、YAML に秘密情報を直接書くのではなく、その行の `config.env` に変数を追加してください。

<a id="choose-one"></a>

## 1 つ選ぶ

| システム | テスト済みの固定バージョン | トランスポート | 上流側の前提条件 |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ と `npm install --global memorix@1.3.0` |
| [MCP Reference Memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ と `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`、または対応するリリースバイナリ |

<a id="enable-one"></a>

## 1 つ有効にする

OCEAN にオーバーレイを 1 つ渡します：

```sh
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

ファイル名は `mcp-reference-memory.cordis.yml` または `engram.cordis.yml` に置き換えられます。パスには、ディスク上の任意の場所にコピーしたファイルを指定できます。同梱の構成にはメモリーサーバーが含まれないため、`--patch` を省略すると 3 つとも無効のままです。

選択を次回以降の実行でも維持するには、選んだファイルの単一の `insert` パッチをユーザーパッチ層にマージします。1 つのプロファイルなら `$OCEAN_HOME/profiles/<name>/cordis.patch.yml`、そのマシンのすべてのプロファイルなら `$OCEAN_HOME/cordis.patch.yml` です。既存ファイルを上書きコピーしないでください。無関係なユーザーパッチがすでに含まれている場合があります。

<a id="provider-setup"></a>

## プロバイダーの設定

### Memorix

```sh
npm install --global memorix@1.3.0
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix は、LLM や埋め込みサービスなしでローカルのヒューリスティックモードで動作します。オプションのプロバイダーは、Memorix 自身の `~/.memorix/config.toml` またはプロジェクトの `memorix.toml` で設定します。この例では、OCEAN の作業ディレクトリから得られる Memorix の Git プロジェクト識別を維持し、Memorix 自身の既定値 `~/.memorix/data` を使用します。上書きするには、OCEAN の起動前に `MEMORIX_DATA_DIR` を設定してください。

### MCP Reference Memory

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

この参照サーバーは、ローカルのナレッジグラフを保存し、エンティティ、関係、観察、読み取り、検索、オープンの各ツールを公開します。モデルや埋め込みサービスは不要です。この例では、インストール済み npm パッケージのディレクトリではなく、`$HOME/.ocean-mcp-reference-memory.jsonl` に JSONL を保存します。上書きするには、OCEAN の起動前に `MEMORY_FILE_PATH` を設定してください。

検索は、エンティティ名、型、観察内容に対する大文字・小文字を区別しない部分文字列一致であり、意味検索ではありません。サーバーは、埋め込み、自動要約、競合解決、忘却ポリシーを追加しません。

### Engram

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram が保存先とプロジェクト選択を管理します。既定では `~/.engram` を使い、OCEAN の作業ディレクトリから Git プロジェクトを検出し、環境変数による上書きとして `ENGRAM_DATA_DIR` または `ENGRAM_PROJECT` を受け付けます。

<a id="optional-shared-model-instruction"></a>

## 任意の共通モデル指示

サーバーのツール説明だけではメモリーが確実に使われない場合、既存のモデル指示に、次の短いベンダーに依存しない指示を追加してください：

> ユーザーが何かを覚えてほしいと頼んだら、メモリー書き込みツールを呼び出してください。過去の情報が関連しそうな場合は、メモリーを検索し、関連する結果を利用してください。

これは補足の指示にすぎません。これらの例は、OCEAN のシステムプロンプトのペルソナを置き換えません。

<a id="verify-write-fresh-session-recall-and-use"></a>

## 書き込み、新しいセッションでの想起、利用を確認する

一意の値を 1 つ使い、手順全体を通じてプロバイダーの保存範囲を変更しないでください：

1. OCEAN のセッション A で、`Remember that my validation drink is lapsang-<unique suffix>.` と依頼します。モデルがプロバイダーの書き込みツールを呼び出し、ツールが成功を返したことを確認します。
2. 同じ稼働中の Host で OCEAN のセッション B を作成します。セッション A の会話はコピーしません。`What is my validation drink? Check memory.` と依頼します。モデルがプロバイダーの検索または想起ツールを呼び出し、その値を返したことを確認します。
3. セッション B のまま、`Use that preference to suggest one drink for the meeting.` と依頼します。回答が想起した値を使っていることを確認します。

新しい OCEAN セッションが必要ですが、Host の再起動は不要です。MCP の子プロセスがクラッシュすると、バックオフ付きの自動再接続とツールの再同期が行われます。障害中もツールは一覧に残り、その間だけ呼び出しが失敗します。再接続の試行枠を使い切るとツールの登録が解除され、再読み込みまたは再起動まで再接続が止まります。初期検出は非同期なので、最初の確認用プロンプトを送る前に、プロバイダーの `mcp__...` ツールが現れるのを待ってください。

<a id="bring-another-mcp-server"></a>

## 別の MCP サーバーを使う

同じエントリのフィールドをコピーし、一意の `id` と `serverName` を使います：

```yaml
- insert:
    - id: memory-my-server
      name: '@ocean/ocean-mcp-client'
      config:
        serverName: my-memory
        transport: stdio
        command: my-memory-mcp
        args: []
        env: {}
        cwd: !!js process.cwd()
```

リモートサーバーには、代わりに `transport: streamable-http`、`url`、`headers` を使ってください。プロバイダー固有のインストール、識別、認証、モデル、埋め込み、永続化、ライセンスは、引き続きプロバイダーの責任です。
