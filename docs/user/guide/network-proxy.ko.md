<a id="run-ocean-behind-a-network-proxy"></a>

# 네트워크 프록시를 통해 OCEAN 실행하기

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | [Español](network-proxy.es.md) | [Français](network-proxy.fr.md) | [Deutsch](network-proxy.de.md) | [Português](network-proxy.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

OCEAN는 모델 호출, 웹 검색, 페이지 가져오기, HTTP를 사용하는 MCP 서버 연결을 표준 프록시 환경 변수에 지정된 프록시를 통해 전송합니다. OCEAN가 시작할 때 환경 변수를 읽으므로 추가 설정이 필요하지 않습니다. 설계 또는 런타임 제약에 따라 직접 연결되는 경우는 아래의 ‘프록시를 거치지 않는 연결’을 참고하세요.

<a id="export-the-variables"></a>

## 변수 내보내기

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

모든 `ocean` 실행에 적용하려면 두 줄을 셸 프로필에 추가하거나 `$OCEAN_HOME/.env`(기본값은 `~/.ocean/.env`)의 API 키 옆에 설정하세요. 셸에서 내보낸 변수가 이 파일의 설정에 우선합니다. 프로젝트의 `.env`는 `git clone`으로 내려받습니다. 저장소가 트래픽의 경로를 지정하지 못하도록 OCEAN는 해당 파일에 프록시 변수가 설정돼 있으면 시작을 거부합니다.

인증이 필요한 프록시는 `http://user:password@proxy.example:8080`처럼 URL에 자격 증명을 넣으세요. OCEAN는 URL을 출력하지 않습니다. 진단 메시지에는 거부된 변수 이름만 표시되므로 사용자 이름과 비밀번호가 드러나지 않습니다.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## 브라우저와 터미널의 프록시 설정이 다른 이유

OCEAN에만 해당하는 동작은 아닙니다. 모든 소프트웨어에 공통으로 적용되는 ‘시스템 프록시’는 없으며 다음 세 가지 방식이 각각 동작합니다.

| 설정 방식 | 적용 대상 |
|---|---|
| 운영 체제의 프록시 설정 | Safari, 대부분의 macOS 네이티브 앱, Chrome, Edge |
| `HTTP_PROXY` / `HTTPS_PROXY` 환경 변수 | `curl`, `git`, `npm`, `pip`, OCEAN |
| TUN 모드(가상 네트워크 인터페이스) | 앱별 설정 없이 모든 연결에 적용 |

Clash 같은 프록시 앱의 ‘시스템 프록시’ 스위치는 운영 체제의 프록시 설정만 바꿉니다. 브라우저는 해당 설정을 읽지만 명령줄 도구에는 환경 변수를 별도로 내보내야 합니다. TUN 모드를 켜면 환경 변수 없이도 양쪽에 프록시를 적용할 수 있습니다.

OCEAN는 운영 체제의 프록시 설정을 읽지 않습니다. 환경 변수를 내보내거나 TUN 모드를 사용하세요.

<a id="choose-what-stays-direct"></a>

## 직접 연결할 호스트 지정하기

`NO_PROXY`에는 직접 연결할 호스트를 나열합니다.

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

각 항목은 해당 호스트와 그 아래 모든 하위 도메인에 적용됩니다. 예를 들어 `NO_PROXY=example.com`이면 `api.example.com`에도 직접 연결합니다. 앞에 `.` 또는 `*.`를 붙여도 의미는 같습니다. 항목에 `:port`를 붙일 수 있으며 `*`는 모든 연결에서 프록시를 우회합니다.

**CIDR 범위는 사용할 수 없습니다.** 운영 체제의 우회 목록에 있는 `10.0.0.0/8` 또는 `192.168.0.0/16` 같은 항목을 `NO_PROXY`에 복사해도 적용되지 않습니다. 호스트 이름이나 도메인 접미사를 사용하세요.

`localhost`나 `127.0.0.1`을 나열할 필요가 없습니다. OCEAN는 자체 Web UI와 로컬 서버의 요청이 프록시를 거쳐 순환하는 것을 막기 위해 루프백에 항상 직접 연결합니다.

<a id="limits-worth-knowing"></a>

## 제한 사항

**SOCKS 프록시는 지원하지 않습니다.** 시작할 때 OCEAN가 `socks5://` 값을 감지하면 진단 메시지를 출력하고 해당 스킴에는 직접 연결합니다. 유효한 `HTTP_PROXY`가 있어도 `HTTPS_PROXY=socks5://…`를 설정하면 `https:`는 직접 연결됩니다. 환경 변수에는 프록시 앱의 HTTP 포트를 지정하세요. 대부분의 앱이 두 포트를 모두 제공하며, HTTP 포트는 대개 SOCKS 포트와 번호가 가깝습니다.

**`ALL_PROXY`만 설정해도 됩니다.** OCEAN는 HTTP와 HTTPS 모두에 이 값을 기본값으로 사용합니다. Node와 curl은 이 변수를 다르게 처리합니다. `HTTPS_PROXY`도 명시하면 설정 의도가 더 분명합니다.

**TLS를 가로채는 사내 프록시에는 해당 인증서가 필요합니다.** 프록시에 연결할 수 있는데도 인증서 오류가 나면, 시작 전에 조직의 CA 번들을 Node에 지정하세요.

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Node는 프로세스를 시작할 때만 이 변수를 읽으므로 `ocean`를 실행하기 전에 내보내세요.

**OCEAN가 실행하는 도구에도 같은 프록시 설정이 적용됩니다.** bash 도구의 명령, `git`, `gh`, 자식 프로세스로 실행되는 MCP 서버는 이 환경 변수를 상속합니다. Node 자식 프로그램은 자체적으로 설치된 런타임을 사용합니다. Node 22.21 이상과 Node 24 이상은 이 변수를 사용하며, 이전 런타임은 직접 연결합니다. 프록시 변수가 SOCKS URL처럼 OCEAN가 거부한 값을 담고 있으면 Node 기반 도구는 실행을 중단하지 않고 직접 연결합니다. `curl`과 `git`은 여전히 해당 값을 읽습니다.

**프록시 URL의 비밀번호도 도구에 전달됩니다.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080`은 일반 환경 변수입니다. 모델이 작성한 명령을 포함해 OCEAN가 실행하는 모든 명령이 이 값을 읽을 수 있습니다. 환경을 출력하는 명령을 실행하면 보존되는 출력에 비밀번호가 남습니다. 셸의 다른 명령에서도 같은 방식으로 동작합니다. 이를 피하려면 자격 증명이 필요 없는 프록시 접속점을 사용하거나 URL 이외의 방식으로 인증하세요.

<a id="what-stays-direct"></a>

## 프록시를 거치지 않는 연결

다음 요청은 프록시를 거치지 않습니다.

- **이 컴퓨터 내부로의 연결.** `localhost`, 전체 `127.0.0.0/8` 범위, `::1`, `0.0.0.0`에는 항상 직접 연결합니다. 로컬에서만 수신하는 서비스에는 프록시가 연결할 수 없습니다.
- **모델이 작성한 코드.** 워크플로 워커와 Node ptc-runtime 프로세스에는 프록시 설정을 전달하지 않습니다. 따라서 모델이 작성한 스크립트는 비밀번호가 들어 있을 수 있는 프록시 URL을 환경 변수에서 읽을 수 없습니다. 프록시가 필요하면 요청을 보내는 코드에서 직접 설정해야 하며 실행 샌드박스의 제약은 계속 적용됩니다.
- **사용량 텔레메트리.** 기본 제공 프로필은 OTel 세션 업로드를 비활성화하므로 프록시를 거칠 텔레메트리 요청이 없습니다. 이를 활성화한 배포에서는 프록시 설정이 닿지 않는 Node 자체 HTTP 클라이언트로 전송하므로 직접 연결되며, 외부로 직접 연결할 수 없는 환경에서는 실패합니다.
- **사설 IP 주소를 직접 지정한 `web_fetch`.** `http://10.0.0.5/` 같은 URL은 프록시 설정 여부와 관계없이 거부됩니다.

<a id="check-that-it-worked"></a>

## 동작 확인하기

에이전트에게 페이지를 가져오라고 요청하고 프록시 앱의 연결 로그를 확인하세요.

```sh
ocean --profile headless "fetch https://example.com and tell me the page title"
```

로그에 요청이 없다면 환경 변수가 OCEAN 프로세스에 전달됐는지 확인하세요.

```sh
env | grep -i proxy
```
