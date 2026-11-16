<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# 역 프록시 뒤에 웹 UI를 게시

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | [Español](public-deployments.es.md) | [Français](public-deployments.fr.md) | [Deutsch](public-deployments.de.md) | [Português](public-deployments.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

`dsh --profile web` 루프백 포트에 GUI를 제공하므로 다른 기계의 브라우저가 도달 할 수 없으며 프로세스는 사용중인 주소에 대해 아무것도 알 수 있습니다. 앞의 역 프록시는 외부 다리를 소유 — 공공 호스트 이름, TLS, 그리고 경로는 청취자에게 전달하기 전에 스트립을 접목 — 그리고 `--public-url` 는 브라우저 사용을 주소 DSH를 말한다:

```sh
dsh --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## 이름 \* `--public-url` 광고안내

`--public-url` 지원하다 `http://` 또는 `https://` 선택적 마운트 접두사와 함께 루트를 정상화하여 끝낼 수 있습니다 `/`. 인쇄 및 오픈 시작 URL을 공급, `DSH_WEB_URL`, 그리고 에이전트의 실행 상황에 웹 GUI URL. 웹 서버는 기원 루트 루트 루트를 제공 하 고 마운트를 배울 수 없습니다. `publicUrl` config 필드는 동일한 광고를 게시합니다.

<a id="what-the-proxy-must-do"></a>

## 프록시는 어떻게 해야 하나요?

- **본문 바로가기 `Host`.** 울타리는 수신을 비교 `Host` 허용 된 당국에 대한, 그래서 프록시는 대신 변경되지 않습니다 청취자의 주소.
- **마운트 접두사 스트립.** 청취자 답변 기원 루트 경로, 그래서 `/ui/api/...` 에 대한 요청은 도착해야합니다 `/api/...`.
- **앞으로 업그레이드.** 모든 요청 및 WebSocket 업그레이드 페이지가 열리면 `Upgrade` 및 `Connection` 헤더를 사용하여 청취자에게 도달해야합니다. TLS는 HTTPS를 제공 할 때 프록시의 외부 다리에 종료합니다.
- **쿠키 범위를 읽으십시오.** 보통 HTTP 문제 호스트 전용 백엔드 `Path=/` 쿠키 없음 `Secure`; 프록시는 다음 재쓰기 `Path` 산에 (`/ui/`) 및 추가 `Secure` HTTPS 법에. 자신의 TLS를 이미 제공하는 백엔드 청취자는 쿠키를 표시 `Secure`, 그래서 프록시만 재쓰기 `Path`.
- **bare 마운트를 리디렉션합니다.** `/ui/` 는 유일한 항목입니다 : 세션 쿠키에 대한 출시 토큰을 교환하고 `/ui/index.html` 는 이미 쿠키를 보유하는 브라우저에 문서를 제공합니다. 제공된 문서는 자체 디렉토리에 대한 URL을 해결하기 때문입니다. `/ui` 에 대한 요청은 `/ui/`로 도착해야하며 스트립 백엔드는 외부 경로가 재구성 할 수 없습니다.

<a id="trust-the-authority-browsers-use"></a>

## 권한 브라우저를 신뢰하십시오

울타리는 루프백, 청취자의 자신의 바인드 주소 및 모든 권위 `--trusted-host` 이름을 받아들입니다. 다른 모든 권한 아래 배포에 도달 하는 브라우저는 403 모든 API 호출에 대 한, 그러나 프록시를 정확 하 게, 그래서 `--trusted-host`와 브라우저 가시적 권위를 이름; `--public-url` 와 광고는 표시만 하 고 그것을 인정 하지 않습니다. 포트가없는 항목은 포트가 일치하지 않고 서로 다른 것을 묶는 터널을 맞습니다. 울타리는 요청을 인정합니다. 인쇄 된 URL의 출시 토큰과 서명 된 세션 쿠키는 그것을 인증합니다. TLS, 그것이 종결되는 경우, 이 중 아무 것도 변경: 인증서는 서버가 브라우저에 식별, 서버에 브라우저가 아닙니다.

광고 된 URL 또는 울타리는 청취 포트 자체를 보호하므로 신뢰할 수있는 프록시 또는 네트워크에 포트를 제한합니다.

<a id="secure-the-external-leg"></a>

## 외부 다리를 보안

프록시에서 TLS를 정의, 청취자 자체에, 또는 둘 다; `--public-url` 는 광고 남아. `http://` 브라우저를 실행하는 루트는 일반 텍스트의 출시 토큰을 노출합니다. `https://` 프록시 루트는 브라우저 프록시 다리를 보호합니다. 프록시와 청취자는 청취자의 TLS 구성에 따라 암호화됩니다.

청취자에 종결하려면 `--tls-cert` 및 `--tls-key`를 통과하고 프로세스 작업 디렉토리에 대해 해결 된 각 경로 : 인증서 파일은 전체 체인을 보유하고 암호화되지 않은 PEM 개인 키를 키 파일. DSH는 결코, 갱신, 또는 인증서를 볼 수 없습니다, 그리고 캐리어는 파일을 한 번 읽습니다, 그래서 그들을 대체하고 청취를 다시로드하거나 그들을 변경하는 과정을 다시 시작; 시작은 누락되거나 잘못된 쌍에 실패하지 않고 HTTP로 돌아 떨어졌다. 브라우저는 자신의 신뢰 저장소와 이름 체크를 적용, 그래서 인증서는 호스트 이름 또는 IP를 커버해야합니다. 기본 포트는 3080을 유지합니다. Native TLS는 프록시가 필요하지만 프록시 배포 및 `--public-url` 는 독립적으로 지원됩니다. TLS 청취자 표시 세션 쿠키 `Secure`; 공공 브라우저를 유지 HTTPS 그래서 브라우저는 그 쿠키를 반환 할 수 있습니다.

인쇄 된 URL은 프로세스 자격 증명을 수행하므로 의도 된 사용자와 함께 공유하십시오.

의 특징 [웹 앱 참조](../../../packages/bundle/web-app/README.md#public-deployments) 서류 제출 `--public-url`, `--trusted-host`, 및 `--tls-cert`/`--tls-key` 명령줄 옵션. 웹 프로파일에서, `publicUrl` 설정하기 `web-runtime` 행, `trustedHosts` 설정하기 [연결 행](../../../packages/client/connection/README.md), 및 `tls` 설정하기 [웹 서버 행](../../../docs/subsystems/web-server.md#config).
