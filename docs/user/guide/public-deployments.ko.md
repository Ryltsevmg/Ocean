<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# 리버스 프록시를 통해 Web UI 공개하기

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | [Español](public-deployments.es.md) | [Français](public-deployments.fr.md) | [Deutsch](public-deployments.de.md) | [Português](public-deployments.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

`ocean --profile web`은 루프백 포트에서 GUI를 제공하므로 다른 컴퓨터의 브라우저는 직접 연결할 수 없습니다. OCEAN 프로세스는 브라우저가 사용하는 외부 주소도 알지 못합니다. 리버스 프록시가 공개 호스트 이름과 TLS를 관리하고, 요청 경로의 접두사를 제거한 후 리스너로 전달합니다. `--public-url`로 브라우저가 사용하는 주소를 OCEAN에 알려 주세요.

```sh
ocean --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## `--public-url`로 지정하는 공개 URL

`--public-url`은 경로 접두사를 선택적으로 포함하는 `http://` 또는 `https://` 기본 URL을 받아 끝에 `/`가 붙도록 정규화합니다. 이 값은 시작할 때 출력하고 여는 URL, `OCEAN_WEB_URL`, 에이전트의 런타임 컨텍스트에 있는 Web GUI URL에 쓰입니다. 웹 서버는 계속 루트 경로에서 응답하며 공개 경로의 접두사를 인식하지 않습니다. `publicUrl` 설정 필드에서도 같은 공개 URL을 지정할 수 있습니다.

<a id="what-the-proxy-must-do"></a>

## 리버스 프록시 설정

- **브라우저가 보낸 `Host`를 유지하세요.** OCEAN는 수신한 `Host`를 허용된 호스트와 포트 목록과 대조합니다. 프록시에서 리스너 주소로 바꾸지 말고 그대로 전달하세요.
- **경로 접두사를 제거하세요.** 리스너는 루트 경로에서 응답하므로 `/ui/api/...` 요청을 `/api/...`로 전달해야 합니다.
- **연결 업그레이드를 전달하세요.** 페이지의 모든 요청과 WebSocket 업그레이드는 `Upgrade`와 `Connection` 헤더를 유지한 채 리스너에 도달해야 합니다. 프록시가 HTTPS를 제공할 때는 외부 연결에서 TLS를 종료합니다.
- **쿠키의 적용 범위를 바꾸세요.** 백엔드가 HTTP를 사용하면 호스트 전용 쿠키를 `Path=/`로 발급하며 `Secure`를 설정하지 않습니다. 프록시는 `Path`를 공개 경로(`/ui/`)로 바꾸고 HTTPS 연결에 `Secure`를 추가해야 합니다. 백엔드가 자체 TLS를 제공하면 이미 쿠키에 `Secure`가 있으므로 프록시는 `Path`만 변경합니다.
- **끝에 슬래시가 없는 공개 경로를 리디렉션하세요.** 시작 토큰을 세션 쿠키로 교환할 수 있는 진입점은 `/ui/`뿐입니다. 이미 쿠키가 있는 브라우저에는 /ui/ 또는 `/ui/index.html`에서 문서를 제공합니다. 문서는 자신의 디렉터리를 기준으로 URL을 해석하므로 `/ui` 요청을 `/ui/`로 리디렉션해야 합니다. 백엔드는 접두사가 제거된 요청에서 외부 경로를 복원할 수 없습니다.

<a id="trust-the-authority-browsers-use"></a>

## 브라우저가 사용하는 호스트와 포트 허용하기

OCEAN는 루프백, 리스너 자체의 바인드 주소, `--trusted-host`로 지정한 호스트와 포트를 허용합니다. 브라우저가 다른 주소로 접속하면 프록시가 올바르게 설정돼 있어도 모든 API 호출에 403이 반환됩니다. 브라우저에 표시되는 호스트와 포트는 `--trusted-host`로 지정하세요. `--public-url`은 공개 URL을 표시할 뿐 요청을 허용하지 않습니다. 포트를 생략하면 모든 포트가 일치하므로 매번 다른 포트를 사용하는 터널에도 적합합니다. 요청을 인증하는 데는 출력된 URL의 시작 토큰과 서명된 세션 쿠키를 사용합니다. TLS 종료 지점과 무관하게 인증서는 브라우저가 서버의 신원을 확인하는 데 쓰이며, 서버가 브라우저를 인증하는 데는 쓰이지 않습니다.

공개 URL 설정과 Host 검사만으로는 수신 포트를 보호할 수 없습니다. 신뢰할 수 있는 프록시나 네트워크에서만 연결할 수 있도록 포트 접근을 제한하세요.

<a id="secure-the-external-leg"></a>

## 외부 연결 보호하기

프록시, 리스너 또는 양쪽에서 TLS를 종료할 수 있습니다. `--public-url`은 공개 URL을 표시하는 데 쓰입니다. 브라우저가 `http://` 주소로 접속하면 시작 토큰이 평문으로 전달됩니다. `https://` 프록시 주소는 브라우저와 프록시 사이를 암호화합니다. 프록시와 리스너 사이의 암호화는 리스너의 TLS 설정에 따라 달라집니다.

리스너에서 TLS를 종료하려면 프로세스의 작업 디렉터리를 기준으로 `--tls-cert`와 `--tls-key` 경로를 지정하세요. 인증서 파일에는 전체 인증서 체인을 넣고 키 파일에는 암호화되지 않은 PEM 개인 키를 넣으세요. OCEAN는 인증서를 발급하거나 갱신하거나 변경을 감시하지 않습니다. 파일은 한 번만 읽으므로 교체한 후 리스너를 다시 로드하거나 프로세스를 다시 시작하세요. 파일 쌍이 없거나 유효하지 않으면 시작에 실패하며 HTTP로 전환하지 않습니다. 브라우저는 자체 신뢰 저장소와 이름 검사를 사용하므로 인증서는 접속할 호스트 이름이나 IP 주소를 포함해야 합니다. 기본 포트는 3080입니다. 리스너에서 TLS를 사용하면 프록시 없이 연결할 수 있으며, 프록시 배포와 `--public-url`도 각각 이용할 수 있습니다. TLS 리스너는 세션 쿠키에 `Secure`를 설정하므로 브라우저가 이 쿠키를 다시 보낼 수 있도록 공개 연결에도 HTTPS를 사용하세요.

시작 시 출력되는 URL에는 프로세스 자격 증명이 들어 있으므로 사용을 허용한 사람에게만 공유하세요.

[Web 앱 참조 문서](../../../packages/bundle/web-app/README.md#public-deployments)에서 `--public-url`, `--trusted-host`, `--tls-cert`, `--tls-key` 명령줄 옵션을 확인할 수 있습니다. Web 프로필에서 `publicUrl`은 `web-runtime` 항목에, `trustedHosts`는 [Connection 항목](../../../packages/client/connection/README.md)에, `tls`는 [webserver 항목](../../../docs/subsystems/web-server.md#config)에 설정합니다.
