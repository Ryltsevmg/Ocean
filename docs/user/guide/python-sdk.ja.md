<a id="get-started-with-the-python-sdk"></a>

# Python SDK を使い始める

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | 日本語 | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

このチュートリアルでは、リポジトリのソースから Python SDK をビルドし、同梱の最小スタンドアロンプロファイルを実行します。さらに、その `ocean` プロファイルを自分のプログラムからカスタマイズします。Ocean SDK の検証済み公開版は、まだ npm にも PyPI にもありません。

<a id="prerequisites"></a>

## 前提条件

- Python 3.10 または newer の
- ギット
- Linux x64、Linux arm64、macOS 14 または arm64 の newer、または Windows x64
- DeepSeek 互換の API エンドポイントと認証情報
- ほかの環境から分離したワークスペースと Ocean ホーム

<a id="build-the-sdk-from-source"></a>

## ソースから SDK をビルドする

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

公開レジストリに検証済みの Ocean SDK はありません。PyPI から `deepseek-harness-sdk` をインストールすると、元のプロジェクトのパッケージが取得されます。このチェックアウトでランタイムの実行ファイルと両方の wheel をビルドし、仮想環境にインストールします。

::: code-group

```sh [Linux/macOS]
git clone https://github.com/Ryltsevmg/Ocean.git
cd Ocean
pnpm install
pnpm exec tsx scripts/build-exe-for-python-sdk.ts
python -m venv .venv
. .venv/bin/activate
python scripts/build-python-release.py --package sdk --output-dir dist-python
python scripts/build-python-release.py --package runtime --platform linux-x64 --runtime-exe dist-exe/deepseek-harness-sdk-runtime-linux-x64 --output-dir dist-python
pip install dist-python/*.whl
```

```powershell [Windows PowerShell]
git clone https://github.com/Ryltsevmg/Ocean.git
Set-Location Ocean
pnpm install
pnpm exec tsx scripts/build-exe-for-python-sdk.ts
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python scripts/build-python-release.py --package sdk --output-dir dist-python
python scripts/build-python-release.py --package runtime --platform win-x64 --runtime-exe dist-exe/deepseek-harness-sdk-runtime-win-x64.exe --output-dir dist-python
python -m pip install (Get-ChildItem dist-python\*.whl)
```

:::

マシンに合う `--platform` の値と、それに対応する `dist-exe/` 内の実行ファイルを選びます。指定できる値は `linux-x64`、`linux-arm64`、`macos-arm64`、`macos-x64`、`win-x64` です。各ターゲットは対応するネイティブアーキテクチャでビルドしてください。インストールには対応するネイティブランタイムの wheel と `ocean` コマンドが含まれます。SDK の通常の実行にシステムの Node.js は不要です。ファイル名、検証、リリース前の確認は [Python の開発手順](../../../python/development.md)を参照してください。

<a id="run-the-checked-in-example"></a>

## リポジトリのサンプルを実行する

認証情報と、必要に応じて互換プロキシのエンドポイントを環境変数としてエクスポートします。

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

::: code-group

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

ワークスペースとホームのパスを明示して、タスクを 1 件実行します。

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

::: code-group

```sh [Linux/macOS]
python python/sdk/examples/minimal.py \
  --workspace /absolute/path/to/disposable-workspace \
  --ocean-home /absolute/path/to/example-ocean-home \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

```powershell [Windows PowerShell]
python python/sdk/examples/minimal.py `
  --workspace C:\work\disposable-workspace `
  --ocean-home C:\work\example-ocean-home `
  --session-id example-001 `
  "Inspect the repository and fix the failing tests."
```

:::

スクリプトは、選択したプロファイルから受け取った最終アシスタント応答またはコマンドの結果を出力します。指定したホームには、生成された `sdk-minimal` プロファイルとインストール済みのプラグインが置かれ、`sessions/` には非圧縮の JSONL セッションログが保存されます。サンプルと SDK が暗黙に `~/.ocean` を読むことはありません。

<a id="use-the-sdk-in-your-program"></a>

## 自分のプログラムで SDK を使う

```python
from pathlib import Path

from deepseek_harness import DeepSeekHarness

workspace = Path("/absolute/path/to/disposable-workspace").resolve()
ocean_home = Path("/absolute/path/to/example-ocean-home").resolve()
with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cwd=str(workspace),
    ocean_home=str(ocean_home),
    profile="sdk-minimal",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

SDK は、同梱の `ocean --profile sdk-minimal` プロセスを必要になった時点で起動し、コンテキストマネージャーを抜けるまで再利用します。プロファイル、その永続パッチ、ホームのパッチ、指定した場合は順序付きの `patches` タプルからアプリケーション設定が構成されます。Python 専用のランタイム実行ファイルや、設定全体を指定するオプションはありません。

<a id="install-or-define-plugins"></a>

## プラグインをインストールまたは定義する

このホームに依存関係やバンドルレイヤーを永続的に追加するには、`ocean plugin` を使います。

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

::: code-group

```sh [Linux/macOS]
export OCEAN_HOME=/absolute/path/to/example-ocean-home
ocean --profile sdk-minimal --dump-default-config >/dev/null
ocean plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

```powershell [Windows PowerShell]
$env:OCEAN_HOME = "C:\work\example-ocean-home"
ocean --profile sdk-minimal --dump-default-config | Out-Null
ocean plugin --profile sdk-minimal add file:C:/work/my-plugin-bundle
```

:::

最初のコマンドは、同梱のスタンドアロンプロファイルを初期化します。2 番目のコマンドは、パッケージ管理を `pnpm` に委ね、`ocean.bundle` レイヤーをエクスポートするインストール済みパッケージを記録します。`pnpm` が必要なのはこの管理コマンドだけで、インストール済みの SDK の起動には不要です。設定エントリを永続的に変更するには `$OCEAN_HOME/profiles/sdk-minimal/cordis.patch.yml` を編集します。起動ごとに変更するには、Python からパッチファイルを渡します。

`@ocean/ocean-sdk-app` または別の JSON-RPC サーバーエントリを含む場合は、別の `profile` も指定できます。サーバーエントリがない、プラグインを解決できない、またはパッチが無効な場合は、別の構成に切り替えず起動に失敗します。

<a id="opt-in-to-str_replace_editor"></a>
### `str_replace_editor` を有効にする

同梱ランタイムに `str_replace_editor` は含まれますが、`sdk-minimal` の既定の Cordis ツリーには登録されていません。利用するには、次の設定を `editor.patch.yml` として保存します。`insert` は既存のファイルシステムプロバイダーを利用するエディターを追加します。

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

`DeepSeekHarness(profile="sdk-minimal", ...)` を作るときに `patches=("/absolute/path/to/editor.patch.yml",)` を渡します。永続設定にするには、パッチを `$OCEAN_HOME/profiles/sdk-minimal/cordis.patch.yml` に保存します。次回のランタイム起動から、モデルへのリクエストには既定ツールに加えて `str_replace_editor` が含まれます。ローカルファイルシステムプロバイダーは相対パスをランタイムの作業ディレクトリから解決します。最小構成のシェルと同様に、そのディレクトリの外へのアクセスも可能です。同じパッチは標準の `sdk` プロファイルでも使えます。

<a id="enable-team-mode"></a>
### チームモードを有効にする

エージェントチームを使うには、標準の `sdk` プロファイルを選びます。`sdk-minimal` にはサブエージェントやチームサービスがありません。[チーム用パッチ](../../../apps/cli/config/examples/team-mode.yml)を `team-mode.yml` として保存します。

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

`profile="sdk"` を指定し、パッチの絶対パスを SDK の `patches` オプションで渡します。Python では `patches=("/absolute/path/to/team-mode.yml",)`、TypeScript では `patches: ["/absolute/path/to/team-mode.yml"]` を使います。パッチは `agent-team` エントリの設定全体を置き換えるため、独自の `maxTasks` 制限があれば同じマッピングに含めてください。

新しいルートセッションを作り、共有タスクを作成して一覧表示するよう依頼します。最初のモデルリクエストにチームツールと共同作業の指示が含まれます。ルートセッションはモードを保存し、サブエージェントはそのモードを共有します。既存のセッションを再開すると、明示的に無効化した場合や、一度も有効化していない場合を含め、保存済みのモードが維持されます。このパッチを変更または削除しても、保存済みの選択は変わりません。モードとタスクの詳細は[チームサービスのリファレンス](../../../packages/team/agent-team/README.md#use-this-package)を参照してください。

<a id="understand-the-minimal-profile"></a>

## 最小プロファイルの仕様

| 項目 | 値 |
|---|---|
| システムプロンプト | `OCEAN_SYSTEM_PROMPT`。未設定時は `You are a helpful software engineer assistant.` |
| `minimal.py` が使うモデル | 優先順に `--model`、`OCEAN_MODEL`、`deepseek-v4-flash` |
| モデルが使えるツール | Linux/macOS では永続的な `bash`、Windows では永続的な `pwsh`。いずれも `read_image` と `working_directory` を利用可能 |
| シェルのタイムアウト | 300 秒 |
| オプションの実行時コンテキスト | なし |
| コンテキストの圧縮 | 自動。追加のモデルリクエストで古い履歴を要約 |
| セッションの永続化 | `<ocean_home>/sessions` に非圧縮の JSONL で保存 |

プロファイル唯一のバンドルが空のルートに構成ツリー全体を挿入します。`ocean-base` を含まないため、ベースプロファイルに追加されるツールは自動で利用可能になりません。SDK プロトコル、環境変数で設定する DeepSeek アダプター 1 つ、ローカル実行、永続化を備えます。テキストファイル用ツール、設定管理、管理対象の認証情報、OTel テレメトリー、Web ツール、サブエージェント、ローカル指示の検出は含まれません。[DeepSeek セッションログ連携](../../../packages/session/session-log-deepseek/README.md)は、既定で未受理のログイベントを DeepSeek リクエストに添付します。1 リクエストあたりの上限は `maxBytes`（8 MiB）です。無効にするにはプロファイルパッチに `session-log-deepseek.enabled: false` を設定します。プロファイルは `danger-full-access` を固定で使うため、プラットフォームに応じた永続シェルはランタイムから見えるあらゆるパスを変更できます。使い捨てのチェックアウトまたはコンテナーで実行してください。

画像を読み取るには、画像対応のモデル経路が必要です。自動圧縮でも完全なセッションログが保持されます。モデルと保存への影響は[バンドルのリファレンス](../../../packages/bundle/sdk-minimal/README.md)を参照してください。この `sdk-minimal` 構成では、認識しないスラッシュ入力は通常のプロンプトとして扱われます。

インストール済みの wheel には、完全な `web` プロファイルとフロントエンドのファイルも含まれます。Python SDK のデプロイでブラウザーアプリも必要な場合は、`OCEAN_HOME` を明示して `ocean web` を実行します。`web` は独立した CLI アプリケーションで、Python SDK クライアントには対応しません。

プロファイル、プラグイン、認証情報、設定、セッションを分離するには、新しいホームを使ってください。独立した作業には新しいセッション ID を使います。同じ永続的な会話と、そのセッションに属するリソースを引き継ぐときだけ、ハーネス、ホーム、ID を再利用してください。

構成ツリーの詳細は[バンドルのリファレンス](../../../packages/bundle/sdk-minimal/README.md)、実行可能なプログラムは[サンプルのリファレンス](../../../python/sdk/examples/README.md)を参照してください。[Python SDK リファレンス](../../../python/sdk/README.md)にはライフサイクル、結果、通知、低レベルの動作が、[ocean CLI リファレンス](../../../apps/cli/reference/README.md)にはプロファイルのレイヤー構成が記載されています。
