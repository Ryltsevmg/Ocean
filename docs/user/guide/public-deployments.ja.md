<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# リバースプロキシ経由で Web UI を公開する

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | 日本語 | [Español](public-deployments.es.md) | [Français](public-deployments.fr.md) | [Deutsch](public-deployments.de.md) | [Português](public-deployments.pt.md) | [한국어](public-deployments.ko.md)
<!-- USER_LANGUAGES_END -->

`ocean --profile web` はループバックアドレスのポートで GUI を提供するため、別のマシンのブラウザーからは直接接続できません。OCEAN プロセスにはブラウザーが使う外部アドレスも分かりません。リバースプロキシが公開ホスト名と TLS を管理し、パスの接頭辞を取り除いてからリスナーに転送します。`--public-url` で、ブラウザーが使うアドレスを OCEAN に伝えます。

```sh
ocean --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## `--public-url` が設定する公開 URL

`--public-url` は、パスの接頭辞を任意で付けた `http://` または `https://` のベース URL を受け取り、末尾を `/` にそろえます。その値は、起動時に表示して開く URL、`OCEAN_WEB_URL`、エージェントの実行時コンテキストにある Web GUI URL に使われます。ウェブサーバーは引き続きルートパスから配信し、公開側の接頭辞は認識しません。設定フィールド `publicUrl` でも同じ公開 URL を指定できます。

<a id="what-the-proxy-must-do"></a>

## リバースプロキシに必要な設定

- **ブラウザーが送る `Host` を保持します。** OCEAN は受信した `Host` を許可されたホスト名とポートに照らして検証します。プロキシはリスナーのアドレスに書き換えず、そのまま転送してください。
- **パスの接頭辞を取り除きます。** リスナーはルートパスからのリクエストに応答するため、`/ui/api/...` へのリクエストは `/api/...` に変換して転送します。
- **接続のアップグレードを転送します。** ページからのすべてのリクエストと WebSocket のアップグレードをリスナーに転送し、`Upgrade` と `Connection` ヘッダーを保持します。プロキシが HTTPS を提供する場合は、外部向けの接続で TLS を終端します。
- **Cookie の適用範囲を書き換えます。** バックエンドが HTTP を使う場合、ホスト限定の Cookie を `Path=/` かつ `Secure` なしで発行します。プロキシは `Path` を公開パス（`/ui/`）に書き換え、HTTPS で配信する場合は `Secure` を付けます。バックエンドが TLS を使う場合は Cookie にすでに `Secure` が付いているため、プロキシは `Path` だけを書き換えます。
- **末尾のスラッシュがない公開パスをリダイレクトします。** 起動トークンをセッション Cookie に交換できるのは `/ui/` だけです。すでに Cookie があるブラウザーには /ui/ または `/ui/index.html` からドキュメントを配信します。ドキュメントは自身のディレクトリを基準に URL を解決するため、`/ui` へのリクエストを `/ui/` にリダイレクトしてください。接頭辞を取り除いた後では、バックエンドは外部のパスを復元できません。

<a id="trust-the-authority-browsers-use"></a>

## ブラウザーが使うホストとポートを許可する

OCEAN はループバック、リスナー自身のバインドアドレス、`--trusted-host` で指定したホストとポートを許可します。それ以外のアドレスからアクセスすると、プロキシの設定が正しくてもすべての API 呼び出しで 403 が返ります。`--trusted-host` にブラウザーから見えるホストとポートを指定してください。`--public-url` は公開 URL を表示するための設定で、リクエストの許可には使われません。ポートを省略すると任意のポートに一致するため、毎回別のポートを使うトンネルでも利用できます。リクエストの認証には、表示された URL の起動トークンと署名済みのセッション Cookie を使います。TLS の終端場所にかかわらず、証明書はブラウザーがサーバーを確認するためのものです。サーバーによるブラウザーの認証には使われません。

公開 URL の指定と Host の検証だけでは待ち受けポートを保護できません。信頼できるプロキシまたはネットワークからだけ接続できるように制限してください。

<a id="secure-the-external-leg"></a>

## 外部との通信を保護する

TLS はプロキシ、リスナー、または両方で終端できます。`--public-url` は公開 URL の表示に使われます。ブラウザーが `http://` の URL にアクセスすると、起動トークンが平文で送信されます。`https://` のプロキシはブラウザーからプロキシまでの通信を暗号化します。プロキシからリスナーまでの通信を暗号化するには、リスナー側で TLS を設定します。

リスナーで TLS を終端するには、プロセスの作業ディレクトリを基準に `--tls-cert` と `--tls-key` のパスを指定します。証明書ファイルには完全な証明書チェーン、鍵ファイルには暗号化されていない PEM 形式の秘密鍵が必要です。OCEAN は証明書の取得、更新、監視を行いません。ファイルの読み込みは 1 回だけなので、差し替えた後はリスナーを再読み込みするか、プロセスを再起動してください。証明書と鍵の組が見つからない場合や無効な場合は、HTTP に切り替えずに起動に失敗します。ブラウザーは自身の信頼ストアと名前検証を使うため、アクセス先のホスト名または IP アドレスが証明書でカバーされている必要があります。既定のポートは 3080 のままです。リスナー自身の TLS にはプロキシが不要で、プロキシによる公開と `--public-url` も独立して利用できます。TLS を使用するリスナーはセッション Cookie に `Secure` を付けます。ブラウザーがその Cookie を返せるよう、公開側も HTTPS にしてください。

起動時に表示される URL にはプロセスの認証情報が含まれるため、利用を許可したユーザーにだけ共有してください。

[Web アプリのリファレンス](../../../packages/bundle/web-app/README.md#public-deployments)に `--public-url`、`--trusted-host`、`--tls-cert`、`--tls-key` の詳細があります。Web プロファイルでは、`publicUrl` を `web-runtime` エントリに、`trustedHosts` を [Connection エントリ](../../../packages/client/connection/README.md)に、`tls` を [webserver エントリ](../../../docs/subsystems/web-server.md#config)に指定します。
