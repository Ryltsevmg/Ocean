<a id="run-dsh-behind-a-network-proxy"></a>

# 네트워크 프록시 뒤에 DSH 실행

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | [Español](network-proxy.es.md) | [Français](network-proxy.fr.md) | [Deutsch](network-proxy.de.md) | [Português](network-proxy.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

DSH는 아웃 바운드 요청을 전달합니다. - 모델 통화, 웹 검색, 페이지 fetches 및 HTTP를 통해 MCP 서버 - 표준 프록시 환경 변수에 의해 명명 된 프록시를 통해. 그것은 발사에 그들을 읽는다; 다른 것은 구성을 필요로하지 않습니다. 디자인 또는 runtime limit에 의해 직접 몇 가지 경로는 아래 "What stay direct"에 나열되어 있습니다.

<a id="export-the-variables"></a>

## 변수 내보내기

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

당신의 포탄 단면도에 있는 두 선을 etc로 두십시오 `dsh` 주장은 그들에게 상속, 또는 `$DSH_HOME/.env` (`~/.dsh/.env` 기본적으로) API 키 옆에; 수출 된 변수는 항상 그 파일에 승리. 프로젝트의 자체 `.env` 설정할 수 없습니다: 그것은 함께 도착 `git clone`, DSH는 저장소가 어디로 가는지 결정할 수 없는 시작을 거부합니다.

자격 증명을 필요로하는 프록시는 URL에서 가져갑니다. `http://user:password@proxy.example:8080`. DSH는 URL을 다시 인쇄하지 않습니다. 진단 이름은 변수를 거부하므로 사용자 이름이나 암호는 어디에서나 나타날 수 없습니다.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## 왜 브라우저가 proxied이지만 터미널이 아닙니다.

이것은 가장 일반적인 놀라움이며 DSH에 특이하지 않습니다. 모든 소프트웨어 obeys가없는 단일 "시스템 프록시"이 없습니다. 관련 메커니즘이 없습니다.

| 메커니즘 | 누가 그것을 따르는 |
|---|---|
| 운영 체제의 프록시 설정 | 사파리, 대부분의 기본 macOS 앱, 크롬 및 Edge |
| 의 특징 `HTTP_PROXY` / `HTTPS_PROXY` 환경 변수 | `curl`, `git`, `npm`, `pip`, 그리고 DSH |
| TUN 모드 (실제 네트워크 인터페이스) | 모든 것, 투명하게 |

Clash와 같은 프록시 응용 프로그램에서 "system proxy" 스위치는 첫 번째 것만 쓸 수 있습니다. Browsers pick it up; 명령줄 도구가 보이지 않습니다. 왜 변수를 내보내는 것은 별도의 단계이며, TUN 모드를 켜는 것은 모든 변수가 없는 작업을 모두 만듭니다.

DSH는 운영 체제의 프록시 설정을 읽지 않습니다. 변수를 내보내거나 TUN 모드를 사용합니다.

<a id="choose-what-stays-direct"></a>

## 어떤 숙박을 선택

`NO_PROXY` 직접 도달하려면 호스트 목록:

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

호스트와 일치하면 아래 모든 하위 도메인과 함께 일치합니다. `NO_PROXY=example.com` 는 `api.example.com` 를 직접 보냅니다. `.` 또는 `*.` 를 지도하고 같은 것을 의미합니다. 항목은 `:port`를 수행 할 수 있으며 `*` 는 모든 것을 우회합니다.

**CIDR 범위는 작동하지 않습니다.** 운영 체제 우회 목록은 종종 `10.0.0.0/8` 또는 `192.168.0.0/16`와 같은 항목이 포함되어 있습니다. `NO_PROXY` 로 그들을 복사하는 것은 효과가 없습니다. 대신 호스트 이름 또는 도메인 suffixes를 사용하십시오.

당신은 목록이 필요하지 않습니다 `localhost` 또는 `127.0.0.1`. DSH는 항상 루프백을 우회합니다. 자신의 웹 UI 및 로컬 서버가 프록시 및 루프를 통해 그렇지 않으면 경로가됩니다.

<a id="limits-worth-knowing"></a>

## 알 수 있는 제한

**SOCKS 프록시는 지원되지 않습니다.** A `socks5://` 값은 시작 및 건너뛰기에서보고되며 DSH는 `HTTPS_PROXY=socks5://…` 를 설정하여 HTTP 프록시를 빌리기보다 `HTTP_PROXY` 가 `https:` 를 직접 나타낸다. 대신 프록시 애플리케이션의 HTTP 포트에서 변수를 점 — 가장 두 개의 노출, HTTP 하나는 일반적으로 neighbouring 포트 번호입니다.

**`ALL_PROXY` 혼자 충분하다.** DSH는 노드와 컬이 다르더라도 두 가지 계획으로 돌아갑니다. `HTTPS_PROXY` 를 명시적으로 설정하는 것은 여전히 분명합니다.

**TLS-intercepting Corporate proxy는 인증서를 필요로 합니다.** 요청이 인증서 오류에 실패하면 프록시가 도달 할 수 있으며, 시작 전에 조직의 CA 번들에서 Node를 포인트로 설정할 수 있습니다.

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Node는 프로세스 시작에서만 변수를 읽습니다. 그래서 실행하기 전에 그것을 수출하십시오. `dsh`.

**도구 DSH는 동일한 프록시를 따라 실행합니다. bash 도구에서** 명령, `git`, `gh`및 MCP 서버는 어린이 프로세스로 시작되어 이러한 변수를 상속합니다. 아이 노드 프로그램은 자체 설치 실행 시간을 사용합니다. 노드 22.21+ 및 노드 24+는 이러한 변수를 존중합니다. 이전 실행 시간은 직접 연결됩니다. 프록시 변수 중 하나는 값 DSH 거부 - SOCKS URL, say — Node-based tools also connect directly rather than failure to start, while `curl` 및 `git` 여전히 그 값을 읽습니다.

**프록시 URL의 비밀번호는 해당 도구에 도달합니다.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` 는 정상적인 환경변수이므로, 모든 명령 DSH 실행은 - 하나의 모델 쓰기를 포함하여 - 그것을 읽을 수 있으며, 그 환경을 인쇄하는 명령은 유지되는 출력의 암호를 넣어. 이것은 이미 쉘에서 다른 모든 것에 대해 행동하는 방법입니다. 그 사정이 있다면, proxy a credential-free entry point를 주거나 URL보다 다른 방법을 정정하십시오.

<a id="what-stays-direct"></a>

## 어떤 숙박을 직접

모든 요청 DSH는 프록시를 통해 간다:

- **이 기계에 아무것도.** 루프백 항상 직접: `localhost`, 전체 `127.0.0.0/8` 범위, `::1`, 및 `0.0.0.0`. 프록시는 로컬로 듣는 서비스에 유용하게 도달 할 수 없습니다.
- **모델 쓰기를 코드.** Workflow 노동자와 노드 ptc-runtime 프로세스는 프록시 설정을받지 않습니다. 그래서 모델에 저장된 스크립트는 암호를 수행 할 수있는 프록시 URL을 읽을 수 없습니다. 직접 요청은 필수 프록시를 구성하고 실행 sandbox에 따라 남아 있어야 합니다.
- **사용법 telemetry.** OTLP exporter는 Node의 자체 HTTP 클라이언트를 사용하므로, 텔레메테이션은 직접 연결하고 직접 egress가 차단되는 곳에 실패합니다. DSH에서 무엇을 할 수 있습니까? `DSH_TELEMETRY_MODE=DISABLED` 를 설정하여 완전히 꺼집니다.
- **`web_fetch` 리터 개인 주소로.** URL은 `http://10.0.0.5/` 와 같은 주소를 명명하는 URL은 프록시에 넣기보다 오히려 거부됩니다. 동일한 refusal은 프록시 구성이 없습니다.

<a id="check-that-it-worked"></a>

## 그 일을 확인

페이지를 읽고 프록시 응용의 연결 로그를 시청하는 에이전트에게 문의하십시오.

```sh
dsh --profile headless "fetch https://example.com and tell me the page title"
```

요청이 나타나지 않는 경우, DSH의 자체 환경에 생존하는 변수를 확인합니다.

```sh
env | grep -i proxy
```
