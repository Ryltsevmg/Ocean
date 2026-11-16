<a id="get-started-with-the-python-sdk"></a>

# Python SDK を始めよう

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | 日本語 | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

このチュートリアルでは、このリポジトリのソースからPython SDKをビルドし、出荷されたスタンドアローン最小限のプロファイルを実行し、同じ `dsh` プロファイルを独自のプログラムからカスタマイズする方法を示します。 オーシャンは、まだ有能なパブリックnpmまたはPyPI SDKの配布はありません。

<a id="prerequisites"></a>

## 前提条件

- Python 3.10 または newer の
- ギット
- Linux x64、Linux arm64、macOS 14 または arm64 の newer、または Windows x64
- DeepSeek対応のAPIエンドポイントと認証
- 孤立したワークスペースと孤立したオーシャンホーム

<a id="build-the-sdk-from-source"></a>

## SDKをソースからビルドする

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

パブリックレジストリは、資格のあるOcean SDKをホストしません。 PyPIから `deepseek-harness-sdk` をインストールすると、ドナープロジェクトのパッケージが、Oceanではなくフェッチされます。 このチェックアウト時にランタイムキャリアと両方のホイールをビルドし、仮想環境にインストールします。

:::コードグループ

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

選択する `--platform` 値とマッチング `dist-exe/` あなたの機械のために実行可能: `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64`, または `win-x64`; ネイティブアーキテクチャで各ターゲットをビルドします。 インストールには、マッチングネイティブランタイムホイールと `dsh` コマンド。 通常 SDK の実行はシステム Node.js を必要としません。 [Pythonコントリビューターワークフロー](../../../python/development.md) これらのビルド手順の正確なファイル名、検証、およびリリースチェックを所有しています。

<a id="run-the-checked-in-example"></a>

## チェックイン例を実行します

必要に応じて、クレデンシャルをエクスポートし、互換性のあるプロキシエンドポイント:

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

:::コードグループ

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

明示的なワークスペースとホームパスで1つのタスクを実行します。

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

:::コードグループ

```sh [Linux/macOS]
python python/sdk/examples/minimal.py \
  --workspace /absolute/path/to/disposable-workspace \
  --dsh-home /absolute/path/to/example-dsh-home \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

```powershell [Windows PowerShell]
python python/sdk/examples/minimal.py `
  --workspace C:\work\disposable-workspace `
  --dsh-home C:\work\example-dsh-home `
  --session-id example-001 `
  "Inspect the repository and fix the failing tests."
```

:::

スクリプトは、選択したプロファイルによって供給された最終的なアシスタント応答またはコマンド結果を表示します。 選択したホームは、生成された `sdk-minimal` プロファイル、インストールされたプラグイン、および `sessions/`の下で非圧縮JSONLセッションログを受け取ります。 例とSDKは無声に読み込まれません。 `~/.dsh`.

<a id="use-the-sdk-in-your-program"></a>

## お使いのプログラムでSDKを使用する

```python
from pathlib import Path

from deepseek_harness import DeepSeekHarness

workspace = Path("/absolute/path/to/disposable-workspace").resolve()
dsh_home = Path("/absolute/path/to/example-dsh-home").resolve()
with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cwd=str(workspace),
    dsh_home=str(dsh_home),
    profile="sdk-minimal",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

SDK は、バンドルされた `dsh --profile sdk-minimal` プロセスを lazily で起動し、コンテキストマネージャーの終了まで再利用します。 プロファイル、その永続的なパッチ、ホームパッチ、および任意の注文 `patches` タプルは、アプリケーション構成を形成します。 Python のランタイム bin やコンフィグオプションは別々にありません。

<a id="install-or-define-plugins"></a>

## プラグインのインストールまたは定義

依存関係やバンドル層の `dsh plugin` を使用して、この家庭で永続する:

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

:::コードグループ

```sh [Linux/macOS]
export DSH_HOME=/absolute/path/to/example-dsh-home
dsh --profile sdk-minimal --dump-default-config >/dev/null
dsh plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

```powershell [Windows PowerShell]
$env:DSH_HOME = "C:\work\example-dsh-home"
dsh --profile sdk-minimal --dump-default-config | Out-Null
dsh plugin --profile sdk-minimal add file:C:/work/my-plugin-bundle
```

:::

最初のコマンドは、出荷されたスタンドアローンプロファイルを初期化します。 2 つは `pnpm`にパッケージ管理を、そして `dsh.bundle` の層を輸出する取付けられたパッケージを記録します。 `pnpm` をこの管理コマンドだけインストールします。インストールされたSDKを起動する必要はありません。 `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` を永続行変更、または、各々の変更のために Python からパッチファイルをパスします。

別の `profile` は、 `@ocean/ocean-sdk-app` または別のJSON-RPCサーバー行を含むときに有効です。サーバー行、未解決プラグイン、および無効なパッチを別の構成に戻す代わりに起動中に欠落させます。

<a id="opt-in-to-str_replace_editor"></a>
### お問い合わせ `str_replace_editor`

バンドルされたランタイムは `str_replace_editor`を含んでいますが、 `sdk-minimal` はデフォルトのコーディッシュツリーからそれを省略します。それを使用するには、この設定を `editor.patch.yml`; `insert` として保存し、既存のファイルシステムプロバイダを使用してエディタを追加します。

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

パス `patches=("/absolute/path/to/editor.patch.yml",)` 建設するとき `DeepSeekHarness(profile="sdk-minimal", ...)`パッチを入れるか `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` 持続的な構成のため。次のランタイムの進水で、モデル要求は下記のものを含んでいます `str_replace_editor` デフォルトのツールの横にある。ローカルファイルシステムプロバイダは、相対パスのランタイム作業ディレクトリを使用します。最小限のシェルと同様に、そのディレクトリへのアクセスは混在しません。同じパッチは標準で動作します `sdk` プロフィール。

<a id="enable-team-mode"></a>
### チームモードを有効にする

標準を使用する `sdk` エージェントチームのプロフィール `sdk-minimal` サブエージェントやチームサービスが含まれていません。 [チームパッチ](../../../apps/cli/config/examples/team-mode.yml) として `team-mode.yml`:

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

SDK の絶対パスを渡す `patches` オプション `profile="sdk"`. Python は `patches=("/absolute/path/to/team-mode.yml",)`; TypeScript の使用 `patches: ["/absolute/path/to/team-mode.yml"]`. パッチは取り替えます `agent-team` 行の全体構成は、従って習慣を含んで下さい `maxTasks` 同じマッピングで制限します。

新しいルートセッションを作成し、共有タスクを作成およびリストするように依頼してください。 チームツールとコラボレーションガイダンスを初めてモデルに依頼。 ルートはモードを保存し、サブエージェントはそれを共有します。 既存のセッションを再開すると、明示的にオフまたは有効にされていない場合でも、そのモードが保存されます。このパッチの変更または削除は、保存された選択を上書きしません。 [チーム サービス参照](../../../packages/team/agent-team/README.md#use-this-package) モードとタスクのセマンティクスの.

<a id="understand-the-minimal-profile"></a>

## 最小限のプロファイルを理解する

| プロパティ | 値 |
|---|---|
| システム プロンプト | `DSH_SYSTEM_PROMPT`、に戻るために落ちる `You are a helpful software engineer assistant.` |
| モデル: `minimal.py` | `--model`, それから `DSH_MODEL`, それから `deepseek-v4-flash` |
| モデリング・フェース・ツール | パーシステント `bash` Linux/macOS または `pwsh` Windowsで、 `read_image`, , , `working_directory` |
| シェルタイムアウト | 300秒 |
| 任意ランタイムのコンテキスト | の研摩剤 |
| コンテキスト圧縮 | 自動; 追加のモデルリクエストを介して古い歴史を要約 |
| セッションの持続性 | 非圧縮JSONL下 `<dsh_home>/sessions` |

プロファイルの唯一のバンドルは、空のルートの上に完全なツリーを差し込み、 `dsh-base`が含まれていません。 したがって、ベースプロファイルのツールは暗黙的に表示されません。 テキストファイルツール、設定、管理された資格情報、OTel テレメトリー、Web ツール、サブエージェント、ローカル ガイドの検出が欠如している間、SDK プロトコル、環境構成の DeepSeek アダプター、ローカルの実行、および永続が含まれています。 [DeepSeekセッションログコントリビューター](../../../packages/session/session-log-deepseek/README.md) は、デフォルトでDeepSeekリクエストで、ほとんどの `maxBytes` (8 MiB)リクエストで、 `session-log-deepseek.enabled: false` をプロファイルパッチで設定して無効にします。 それは `danger-full-access`をピンで止めます、従ってプラットホーム選ばれたpersistentの貝はランタイムに目に見えるパスを変えることができます;使い捨て可能なチェックアウトか容器を使用して下さい。

画像読み込みには、画像処理可能なルートが必要です。 自動コンパクト化により、セッションログが完全に保存されます。 [バンドルリファレンス](../../../packages/bundle/sdk-minimal/README.md) を参照して、モデルとストレージ効果を確認します。 この `sdk-minimal` 構成では、サポートされていないスラッシュ入力は通常のプロンプトテキストのままです。

インストールされたホイールは、 `web` プロファイルとフロントエンドアセットをフルパッケージ化します。 Python SDK のデプロイメントがブラウザアプリケーションを必要とするときに、 `dsh web` を明示的に `DSH_HOME` から実行します。 `web` は別々の CLI アプリケーションで、Python SDK クライアントには対応できません。

プロファイル、プラグイン、資格情報、設定、セッションを分離する必要がある場合は、新鮮な家を使用してください。独立した作業のために新鮮なセッション ID を使用してください。ハーネス、ホーム、id を再利用して、同じ耐久性のある会話とセッション所有リソースを継続します。

ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ザ・ [バンド参照](../../../packages/bundle/sdk-minimal/README.md) 正確な木を所有し、 [サンプル参照](../../../python/sdk/examples/README.md) 実行可能なプログラムを所有しています。 [Python SDKリファレンス](../../../python/sdk/README.md) ライフサイクル、結果、通知、および低レベルの動作をカバーします。 [dsh CLI リファレンス](../../../apps/cli/reference/README.md) プロフィールの層を覆います。
