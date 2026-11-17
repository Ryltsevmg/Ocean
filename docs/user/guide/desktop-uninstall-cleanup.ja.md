<a id="uninstall-ocean-desktop"></a>

# Ocean Desktop をアンインストールする

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | 日本語 | [Español](desktop-uninstall-cleanup.es.md) | [Français](desktop-uninstall-cleanup.fr.md) | [Deutsch](desktop-uninstall-cleanup.de.md) | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

このガイドでは、macOS、Windows、Linux で Ocean Desktop をアンインストールします。ローカルデータの削除は任意です。

<a id="1-uninstall-the-app"></a>

## 1. アプリをアンインストールする

Desktop に同梱された CLI を使うコマンドをすべて終了してください。Desktop から `ocean` コマンドをインストールした場合は、先にアプリケーションメニューの **Manage ocean Command… → Remove** を選びます。これにより Desktop のコマンド登録が解除されますが、独立した CLI プログラムはアンインストールされません。

Ocean を終了し、各プラットフォームの手順でアンインストールします：

- **macOS：** Finder の「アプリケーション」からアプリを削除します。
- **Windows：** Windows 11 の「設定 → アプリ → インストールされているアプリ」、または「コントロール パネル → プログラム → プログラムと機能」からアンインストールします。
- **Linux：** インストール時と同じ方法で削除します。展開したディレクトリから使っている場合は、アプリを終了してからそのインストールディレクトリを削除します。

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. 削除前にローカルデータを確認する

ローカルデータを削除すると、セッション、認証情報、設定、プラグイン、キャッシュ、共有の CLI 状態が完全に失われる場合があります。残したいものはバックアップしてください。名前が Ocean や OCEAN に似ているという理由だけで、ディレクトリを削除しないでください。

現在の Ocean の既定のホームは `~/.ocean`、Windows ではユーザープロファイル内の `.ocean` です。`OCEAN_HOME` で別の場所を指定できます。現在のターミナルとは異なる場合があるため、Desktop の起動時に使われた設定を確認してください。以下のコマンドは候補の場所を表示するだけで、何も削除しません。Electron の実際の `userData` ディレクトリや、インストール固有のすべてのキャッシュを検出するものではありません。

::: code-group

```sh [macOS]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${OCEAN_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: $HOME/Library/Caches/@oceanocean-desktop-updater"
# Previous-release ~/.ocean and donor-era appId caches require separate ownership checks.
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
if (-not $env:USERPROFILE -or -not $env:LOCALAPPDATA) {
    throw 'USERPROFILE and LOCALAPPDATA must be set.'
}
$oceanHome = if ($env:OCEAN_HOME) { $env:OCEAN_HOME } else { Join-Path $env:USERPROFILE '.ocean' }
"Ocean home candidate: $oceanHome"
"Updater cache candidate: $(Join-Path $env:LOCALAPPDATA '@oceanocean-desktop-updater')"
# Previous-release .ocean and @deepseek-ai data are NOT removed.
# Inspect them separately; delete only data you recognize and no longer need.
```

```sh [Linux]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${OCEAN_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: ${XDG_CACHE_HOME:-$HOME/.cache}/@oceanocean-desktop-updater"
# Previous-release ~/.ocean requires a separate ownership check.
```

:::

アップデーターのキャッシュ名は、製品名ではなく Desktop のパッケージ名から決まります。これらの候補は現在の `@ocean/ocean-desktop` パッケージに基づいており、別のビルドでは異なる場合があります。Windows の[アンインストーラー](../../../apps/desktop/installer/uninstall.nsh)は、製品名・パッケージ名に基づくアプリデータのディレクトリとアップデーターキャッシュを確認しますが、Ocean のホームは保持します。更新やデータを保持した再インストールでも、アプリデータが保持される場合があります。

削除前に、お使いのインストールで実際に使われている Electron のデータ・ログディレクトリを特定してください。ログの場所は[診断リファレンス](../../../apps/desktop/docs/diagnostics/README.md#report-contents)に記載されています。macOS の設定、ShipIt、HTTP ストレージ、システムキャッシュの名前は、インストールされたバンドル識別子によって異なります。パッケージ作成には明示的な `OCEAN_DESKTOP_APP_ID` が必要です。`com.deepseek.ocean` は、すべての Ocean に共通する識別子ではありません。その識別子のファイルが以前のインストールの残存物だと個別に確認できていない限り、ワイルドカードでまとめて削除しないでください。

`~/.ocean` は以前の既定値であり、現在の既定値ではありません。このディレクトリ、以前の `@deepseek-ai` アプリデータ、移植元の時代の識別子に対応するキャッシュは、残存物だと認識でき、ほかのインストールが必要としていない場合に限って削除してください。開発・テスト用ディレクトリは、それぞれ別途確認が必要です。

<a id="3-remove-verified-data-and-check"></a>

## 3. 確認済みのデータを削除して確認する

各パスとその所有元を正確に確認してから、選んだディレクトリだけをファイルマネージャーで削除してください。不明なパスはそのままにします。再インストール前に、選んだパスが存在しなくなったことを確認してください。削除時にエラーが出た場合は、削除対象を広げるのではなく、残ったファイルを調べてエラーを解決してください。
