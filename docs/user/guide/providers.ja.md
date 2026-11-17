<a id="configure-models"></a>

# モデルを設定する

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | 日本語 | [Español](providers.es.md) | [Français](providers.fr.md) | [Deutsch](providers.de.md) | [Português](providers.pt.md) | [한국어](providers.ko.md)
<!-- USER_LANGUAGES_END -->

このガイドでは、[開発ガイド](../../development.md)に従って Web UI を起動済みであることを前提とします。モデルの変更はサーバーを再起動しなくても次のリクエストから有効になります。

<a id="configure-deepseek"></a>

## DeepSeek を設定する

**設定 → モデル**を開きます。DeepSeek カードには API キーの入力欄が一つあります。キーを入力して保存します。

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

キーは書き込み専用です。保存後にページに渡されるのは伏せ字にした情報で、秘密の値そのものは返されません。キーは `$OCEAN_HOME/.credentials.yaml` に保存され、設定にはその資格情報への参照だけが残ります。

キーを保存し、既定のエンドポイントを使っている場合、DeepSeek API が公開するモデル一覧が使われます。最初に必要になったときに一覧を読み込み、利用中は約 10 分ごとにバックグラウンドで更新します。取得できない場合は組み込みモデルが使われます。**カスタマイズ設定**の **モデル**を編集すると独自の一覧に切り替わり、**既定値に戻す**と公開一覧の利用を再開して再取得します。公開一覧の使用中もカードには組み込みモデルが表示されるので、新たに公開されたモデルはモデル選択メニューにだけ表示されます。取得、フォールバック、利用条件の詳細は [API キープロバイダーのリファレンス](../../../packages/llm/llm-deepseek-api-key/README.md)を参照してください。

<a id="add-a-third-party-provider"></a>

## サードパーティーのプロバイダーを追加する

**モデルプロバイダーを追加**を選びます。カードは **サードパーティーのモデルプロバイダー**で開きます。同梱の一覧から、`anthropic`、`openai`、Kimi の `moonshotai`、GLM の `zai` などを選び、API キーを入力して保存します。エンドポイント、プロトコル、モデル一覧はインストール済みカタログから取得されます。

認証欄の **?** には、保存済み認証情報の優先順位と環境変数が使われる条件が表示されます。入力欄を空にすると、保存済みキーまたは一覧の環境変数が使われます。緑は環境変数を検出した状態、黄色は検出していない状態です。黄色の場合は API キーを入力するか、指定された環境変数を設定してください。未確認という表示は、状態を取得できなかったことを示します。この検出では認証情報の検証や接続テストは行いません。AWS プロファイルや Google のアプリケーションのデフォルト認証情報など、プロバイダーが管理する認証情報ファイルは対象外です。`openai-codex` など独自のキー認証を備えないプロバイダーでは、プロファイルで認証情報の参照を明示しない限りキー欄は表示されません。

保存済みキーは入力欄に一部を隠してプレビュー表示され、緑の案内で保存済みキーを使うことが示されます。中間の文字を 8 文字以上隠せる場合に限り、最初のハイフンまたはアンダースコアより前の識別子と、キーの先頭 5 文字、末尾 4 文字を表示します。それ以外の場合は、キーも識別子もすべてドットで表示します。文字数は Unicode コードポイントで数えます。保存済みキーには表示ボタンがなく、表示、コピー、切り取り、一部編集はできません。入力や貼り付けでキー全体が置き換わります。Backspace または Delete → **適用**で保存済みのキーを削除し、環境変数での認証に戻します。置き換え用のキーを空にした場合も削除候補になります。保存前に **キャンセル**すると削除されません。削除が拒否された場合、設定は変わりません。キーの削除後に設定の保存が失敗すると、削除は取り消せないと警告されます。**適用**を再試行して設定を保存するか、**閉じる**でその状態を残します。共有の認証情報を削除すると、その参照を使うすべての機能に影響します。環境変数に認証情報がなければ、プロバイダーは認証情報なしになります。欄が空で環境変数にフォールバックする場合は、**空欄のまま環境変数で認証**と検出結果が 1 件表示されます。置き換え用のキーを入力中は新しいキーを適用するよう表示されます。削除候補の場合は、経路に環境変数が設定されていれば適用後に使う変数名が表示されます。それ以外の空欄でない入力では認証状態は表示されません。アドレス設定の変数は **ベース URL** の下に表示され、認証情報には含まれません。

未保存キーを編集中は目のアイコンが表示されます。**シークレットを表示**で入力を確認し、**シークレットを非表示**で再び隠します。入力を変更しても再び隠れます。パスワード欄からは切り取れないので、入力を選択して Backspace で消すか、表示してから切り取ってください。保存済みの認証情報は書き込み専用です。

<a id="add-a-custom-model-api"></a>

## カスタムモデル API を追加

リレー、社内ゲートウェイ、セルフホストサーバー、カタログにないプロバイダーには、カードを **カスタムモデル API** に切り替えます。小文字のプロバイダー ID、ベース URL、API プロトコル、認証情報、少なくとも 1 つのモデルを指定します。ゲートウェイが対応する **API プロトコル**を選びます。OpenAI Chat Completions、OpenAI Responses、Anthropic Messages、Gemini API の 4 種類があり、使用中のプロファイルの `cordis.patch.yml` にそれぞれ `openai-completions`、`openai-responses`、`anthropic-messages`、`google-generative-ai` として保存されます。Gemini API のベース URL には `https://gateway.example/v1beta` のように API バージョンを含めます。プロバイダーは 1 種類のプロトコルを使うので、2 種類に対応するゲートウェイにはプロバイダーが 2 つ必要です。

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

プロバイダー ID は、リクエスト、保存済みセッション、既定モデル、認証情報の参照に使われるので変更できません。ID を変えるには新しいプロバイダーを追加し、古いものを削除します。表示名、ベース URL、プロトコル、認証情報、モデルは変更できます。

<a id="discover-models"></a>

### 利用可能なモデルを調べる

**モデルカタログ**で **利用可能なモデルを取得**を選ぶと、エンドポイントにモデルを問い合わせます。フォームのベース URL、プロトコル、キー、または保存済みプロバイダーのキーを使います。結果は検索できる一覧に表示され、登録済みモデルは選択済みです。追加するモデルにチェックを付け、削除するモデルのチェックを外して **一覧を更新**を選びます。エンドポイントが返さない設定済みモデルは保持されます。プロバイダーを保存または作成するまで変更は保存されません。

モデルの取得機能は一般的なゲートウェイの一覧形式に対応します。取得に失敗した場合や何も表示されない場合は、モデル ID を手動で追加すれば同じように使えます。組み込みプロバイダーの一覧は、ベース URL がゲートウェイを指していてもインストール済みカタログから取得されます。ゲートウェイが提供するモデルを調べるにはカスタムプロバイダーを使います。

<a id="select-a-model"></a>

## モデルを選択

設定したプロバイダーはモデル選択メニューに表示されます。選んだモデルは新しいセッションの既定値になります。すでにリクエストを送信したセッションは、そのログに記録したモデルを使います。

モデルの順序を変えるには、**設定 → モデル**でプロバイダーを編集し、**カスタマイズ設定**を開いてモデルの三本線のハンドルをドラッグします。ハンドルにフォーカスし、上下の矢印キーでも移動できます。**適用**で確定し、**キャンセル**で破棄します。モデル選択メニューはプロバイダー内で保存した順序に従います。

保存した既定モデルのプロバイダーが削除されると、入力欄には **モデルを選択**と表示されます。別のモデルを選ぶまで入力できません。

<a id="advanced-configuration"></a>

## 高度な構成

生成された [プラグイン構成カタログ](../../config-catalog.md) は、すべてのサポートされているフィールドとすべてのプラグインのデフォルトをリストします。 [`ocean-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) は、このページが設定するプロバイダセクションです。 [`ocean-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) と [`ocean-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) は、直接 `cordis.patch.yml` の設定、カタログの解像度、推論制御、認証情報、およびアダプターのエラーを記述しています。

::: tip 追加設定

モデルページでは、API キー、表示名、ベース URL、API プロトコル、各モデルの ID、表示名、コンテキストウィンドウ、最大出力トークン数、入力タイプ、カスタムモデル API プロバイダーの推論レベルを設定できます。組み込みプロバイダーのモデルの推論レベル、リクエストの互換性、ヘッダー、タイムアウト、再試行ポリシーは、ページが書き込むのと同じ `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml` で設定します。直接編集するか、ブラウザーとサーバーが同じマシンで動いている場合は、設定画面のヘッダーにある **設定ファイルを開く**を使います。アダプターは次のリクエストでファイルを読み直すので、再起動は不要です。以下では、多くのゲートウェイで必要な設定を説明します。

標準の `ocean web` で Web UI を起動した場合、`<profile>` は `web` なので、パスは `$OCEAN_HOME/profiles/web/cordis.patch.yml` です。独自のプロファイルで起動した場合は、起動時に選んだ名前を使います。

:::

<a id="image-input"></a>

### 画像入力

**設定 → モデル**でプロバイダーを編集し、**カスタマイズ設定**を開いて対象モデルの **モデルオプション**を展開します。容量の項目の下に **入力タイプ** が表示されます。画像対応モデルでは **画像**を選んで保存します。画像対応を継承していない新規カスタムモデルでは **テキスト**が初期選択されています。少なくとも 1 つのタイプを選ぶ必要があるため、画像専用モデルではテキストの選択を外す前に画像を選びます。

チェックボックスは、pi-ai モデルでは `input`、直接接続の DeepSeek アダプターでは `inputModalities` を保存します。`$OCEAN_HOME/profiles/<profile>/cordis.patch.yml` でもモデルを編集できます。以下のカスタム pi-ai プロバイダーは、テキスト専用モデルと画像対応モデルを 1 つずつ定義しています。

例はプロファイルパッチ内の設定を示します。Cordis の設定の上書きはエントリの設定全体を置き換えるので、既存の上書きを編集する場合は、ほかのプロバイダーやフィールドを残してください。

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
            input: [text, image]
```

pi-ai の `input` は `text` と `image` を受け付け、そのモデルだけに適用されます。空でない明示的な指定が優先されます。`input` が未指定または空なら、インストール済みカタログの入力タイプを継承し、そこにもなければ経路の `defaultInput`（既定値は `[text]`）を使います。項目を開くだけでは継承した値が表示され、上書きは保存されません。

DeepSeek は `inputModalities` を省略するとテキスト専用として扱い、空のリストは拒否します。テキスト専用モデルに画像の制限は設定できないため、画像の選択を外すと `imagePixelBudget` と `imageMaxBytes` が削除されます。画像対応を再び有効にし、独自の上限が必要なときは設定し直してください。

継承に戻すには、`cordis.patch.yml` から対象モデルの `input` または `inputModalities` を削除します。**既定値に戻す**は、ほかのモデルの変更も含め、カタログの上書き全体を削除します。カタログ全体を戻す場合に使ってください。

手動で入力したすべてのモデルが画像に対応している場合は、モデルごとに設定せず、経路にフォールバックを設定します。

```yaml
- id: llm-pi-ai
  config:
    providers:
      vision-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://vision.example/v1
        defaultInput: [text, image]
        models:
          - id: first-model
          - id: second-model
```

`defaultInput` の既定値は `[text]` です。組み込みプロバイダーでは、カタログに記載されていないモデルだけに適用されるため、カタログ上の画像対応モデルから画像入力を取り除くことはありません。そのモデルの入力タイプを絞るには、自身の `input` を指定します。組み込みプロバイダーに明示的な `models` リストがなければ、モデル ID をキーとして `modelOverrides` に記述します。

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

pi-ai 設定では、モデル自身の `input` を除き、各リストに少なくとも 1 つの入力タイプが必要です。例外のフィールドでは空のリストは省略と同じ意味です。未知の入力タイプはどこで指定しても拒否されます。

両フィールドはエンドポイントの対応状況を宣言するもので、対応の有無を検証しません。エンドポイントが画像に対応していない場合は、画像を許可してもプロバイダーがリクエストを拒否します。

<a id="deepseek-account-models"></a>

### DeepSeekアカウントモデル

サインインした DeepSeek アカウントでは、アカウントサービスからモデル一覧を取得するため、モデルページから一覧を編集できません。個別モデルを調整するには、`$OCEAN_HOME/profiles/<profile>/cordis.patch.yml` の `modelOverrides` を使います。フィールドは DeepSeek の `models` エントリと同じです。未設定のフィールドでは取得した値を保持します。

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

新しい Ocean が必要なモデルは、インストールすべきバージョンを示す `CLIENT_UPGRADE_REQUIRED` エラーを返します。取得、フォールバック、利用条件は[アカウントプロバイダーのリファレンス](../../../packages/llm/llm-deepseek-account/README.md)を参照してください。

<a id="reasoning-effort"></a>

### 推論レベル

推論レベルを宣言したモデルでは、モデル選択メニューに **推論レベル**が表示されます。組み込みプロバイダーはインストール済みカタログのレベルを継承し、DeepSeek はアダプターのレベルを使います。手動で入力したモデルは、レベルを追加するまでメニューに表示されず、推論するかどうかはエンドポイントの既定設定が決めます。

カスタムモデル API プロバイダーでは、**設定 → モデル**でプロバイダーを編集し、**カスタマイズ設定**の **モデルオプション**で **推論レベル**を有効にします。初期状態には off、low、medium、high の行があります。各レベルの **API 値**は送信する値で、既定ではレベル名と同じです。プロバイダーの API ドキュメントで表記が異なる場合に変更し、エンドポイントに合わせて行を追加または削除します。off 以外のレベルを 1 つ以上残して保存してください。スイッチを無効にすると宣言が削除されます。

モデルページは `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml` に `reasoningEfforts` を保存します。ファイルに直接レベルを指定することもできます。

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        reasoning: high
        models:
          - id: my-reasoner
            reasoningEfforts:
              off:
              high: high
              max: max
```

キーはメニューのレベルで、値は `reasoning_effort` として送る文字列です。`max: xhigh` のように、ゲートウェイが期待する表記を指定できます。値を空にできるのは `off` だけです。多くのエンドポイントではパラメーターを省略すると推論が無効になります。経路の `reasoning` はセッションでレベルを選択していない場合に使われます。メニューでレベルを選ぶと、モデルとともに新規セッションの既定値として保存されます。

`off` の値が空なら推論パラメーターを送らないため、要求された場合だけ推論するモデルでのみ推論が止まります。`off` に値があれば `reasoning_effort` として送ります。OpenAI 互換ゲートウェイ経由の DeepSeek V4 のように、明示的に止めない限り推論するモデルには `compat.thinkingFormat: deepseek` が必要です。`off` では `thinking: {type: disabled}` を、ほかのレベルではレベルに加えて `thinking: {type: enabled}` を送ります。

```yaml
        models:
          - id: deepseek-v4-pro
            compat:
              thinkingFormat: deepseek
            reasoningEfforts:
              off:
              high: high
              max: max
```

推論非対応のゲートウェイ経由で組み込みモデルを使うには、`modelOverrides` に `reasoningEfforts: false` を指定します。そのモデルでレベルを選ぶと `UNSUPPORTED_REASONING_EFFORT` で拒否されます。DeepSeek の直接経路では `off`、`low`、`high`、`max` を利用でき、モデル選択メニューの初期値は `llm-deepseek.reasoningEffort` で設定します。

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### リクエストの互換性

キーが有効でアドレスに接続できても、ゲートウェイがすべてのリクエストを拒否する場合があります。pi-ai はシステムプロンプトのロール、出力上限のフィールド、推論レベルの渡し方をエンドポイントの URL から判断します。認識できない URL には OpenAI と同じ形式で送ります。多くの OpenAI 互換ゲートウェイはその形式の一部に対応していません。

主な違いは 2 つです。推論を宣言したモデルのシステムプロンプトは `role: "developer"` で送られ、多くのゲートウェイが拒否します。出力上限は `max_completion_tokens` として送られ、`max_tokens` だけに対応するサーバーが拒否します。フォームに設定欄がないため、`$OCEAN_HOME/profiles/<profile>/cordis.patch.yml` の経路設定で変更します。

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        compat:
          supportsDeveloperRole: false
          maxTokensField: max_tokens
        models:
          - id: my-model
```

経路の `compat` は各モデルの既定値です。モデル自身の設定がフィールドごとに優先されるため、経路全体を書き直さずに特定のモデルだけを調整できます。

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

経路とモデルのどちらにもない項目は、インストール済みカタログの値を使います。カタログにもなければ、pi-ai が自動判定します。スイッチには必ず値を指定してください。`supportsDeveloperRole:` のように空のキーは、値を指定せずカタログの値を消してしまうため拒否されます。どのプロトコルも受け付けない名前も拒否され、メッセージに有効な名前が表示されます。

スイッチはプロトコルに依存します。ある `api` で有効な設定が別のプロトコルで拒否される場合、そのプロトコルで選べるスイッチが表示されます。`input` と同様に、スイッチはエンドポイントが対応している内容を宣言し、検証は行いません。ゲートウェイに不要なスイッチを設定すると、送信される内容が変わります。

スイッチ、許容値、対応プロトコルは、ソースから生成される [`ocean-llm-pi-ai` 設定リファレンス](../../config-catalog.md#oceanocean-llm-pi-ai)の `PiAiCompatProfile` を参照してください。

<a id="troubleshooting"></a>

## トラブルシューティング

- **`MISSING_CREDENTIAL`** — プロバイダーのキーをモデルページから保存するか、参照された環境変数を供給します。
- **`UNKNOWN_MODEL`** — 設定されたモデルを選択するか、カスタムプロバイダーに欠落したモデルを追加してください。
- **利用可能なモデルをフェッチすると、401** が返されます。キーを確認してください。モデルディスカバリーはOpenAI互換の `GET /models` エンドポイントを呼び出します。モデルを手動で入力して、提供しないエンドポイントにモデルを手動で入力します。
- **モデル取得時に `data` 配列も `models` オブジェクトもないと表示される**。一覧の形式に対応していません。モデルを手動で入力してください。
- **ゲートウェイは、キーと URL が正しい** であるが、すべてのリクエストを拒否します。そのリクエストは OpenAI の仕様と異なるためです。 `compat.supportsDeveloperRole: false` と `compat.maxTokensField: max_tokens` からルートで起動します。
- **推論モデルだけが失敗する**。pi-ai がシステムプロンプトを `developer` ロールで送信し、ゲートウェイが拒否しています。`compat.supportsDeveloperRole: false` を設定してください。
- **手動で入力したモデルに推論レベルのメニューが表示されない**。レベルが宣言されていません。カスタムモデル API プロバイダーでは対象モデルの **モデルオプション**で **推論レベル**を有効にします。それ以外では `cordis.patch.yml` のモデルに `reasoningEfforts` を追加してください。
- **`off` でも DeepSeek モデルが推論を続ける**。空の `off` は推論フィールドを送信しないので、既定で推論するエンドポイントは推論を続けます。モデルまたは経路に `compat.thinkingFormat: deepseek` を設定してください。
- **互換性スイッチに値がないというエラーが出る**。コロンの後に値がありません。値を指定するか、キーを削除してインストール済みカタログの値を使ってください。
- **画像が送信前に拒否される**。モデルに画像の入力タイプが宣言されていません。カスタムプロバイダーではモデルに `input: [text, image]` を指定してください。DeepSeek の直接経路では、カタログで画像対応の項目（既定は `deepseek-flash`）を選び、ゲートウェイがそのモデルの画像入力に対応していることを確認してください。
- **画像を含むリクエストがプロバイダーに拒否される**。モデルに画像入力を許可していても、エンドポイントは画像に対応していません。モデルの `input` または経路の `defaultInput` のうち、画像を許可したリストから `image` を削除し、新しいセッションを開始してください。添付画像はセッションログに残り、セッションが変わるまで同じリクエストが繰り返されます。
