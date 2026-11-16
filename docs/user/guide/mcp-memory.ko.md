<a id="connect-a-third-party-memory-mcp-server"></a>

# 타사 메모리 MCP 서버 연결

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | [日本語](mcp-memory.ja.md) | [Español](mcp-memory.es.md) | [Français](mcp-memory.fr.md) | [Deutsch](mcp-memory.de.md) | [Português](mcp-memory.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

아래 세 가지 **기본적으로 꺼져 있는 참조 설정**은 [`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md)를 통해 메모리 시스템 하나를 DSH에 연결합니다. 하나를 선택하거나 같은 일반 MCP 항목을 복사해 다른 서버에 사용하세요.

이 타사 설정은 상호 운용성 예시로만 제공됩니다. 여기에 포함되었다고 해서 Ocean 프로젝트의 지지, 추천, 제휴 또는 지속적인 지원을 의미하지는 않습니다.

<a id="what-dsh-does"></a>

## DSH의 역할

DSH는 선택한 Cordis 오버레이를 파싱하고, 설정된 stdio 명령을 시작하거나 설정된 Streamable HTTP URL에 연결하며, MCP 도구를 검색해 `mcp__<serverName>__<tool>`로 노출합니다. DSH는 서버 다운로드, 데이터베이스 초기화, 모델 또는 임베딩 제공업체 선택, 클라우드 계정 생성, 공급업체 데이터 마이그레이션, 별도 HTTP 서비스 감독을 **수행하지 않습니다**. stdio에서는 일반 클라이언트가 DSH 플러그인 수명 주기에 맞춰 자식 프로세스를 시작하고 중지합니다. HTTP에서는 업스트림 서비스가 이미 실행 중이어야 합니다.

stdio 브리지는 자식 프로세스를 시작하기 전에 이름상 인증 정보를 나타내는 환경 변수와 모든 `DSH_*` 변수를 의도적으로 제거합니다. 다른 환경 변수는 그대로 상속됩니다. 각 예시는 필요한 기본 재정의만 추가합니다. 업스트림의 선택적 기능에 다른 비밀 정보가 필요하다면 YAML에 값을 직접 넣지 말고 해당 항목의 `config.env`에 변수를 추가하세요.

<a id="choose-one"></a>

## 하나 선택하기

| 시스템 | 테스트한 고정 버전 | 전송 방식 | 업스트림 사전 요구 사항 |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ 및 `npm install --global memorix@1.3.0` |
| [MCP Reference Memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ 및 `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`, 또는 일치하는 릴리스 바이너리 |

<a id="enable-one"></a>

## 하나 활성화하기

DSH에 오버레이 하나를 전달하세요:

```sh
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

파일 이름을 `mcp-reference-memory.cordis.yml` 또는 `engram.cordis.yml`로 바꾸세요. 경로는 디스크의 어느 위치에 복사한 파일이든 지정할 수 있습니다. 기본 배포 구성에는 메모리 서버가 없으므로 `--patch`를 생략하면 세 가지 모두 비활성 상태로 유지됩니다.

선택을 다음 실행에도 유지하려면 선택한 파일의 단일 `insert` 패치를 사용자 패치 계층에 병합하세요. 프로필 하나에는 `$DSH_HOME/profiles/<name>/cordis.patch.yml`, 컴퓨터의 모든 프로필에는 `$DSH_HOME/cordis.patch.yml`을 사용합니다. 기존 파일을 덮어쓰지 마세요. 관련 없는 사용자 패치가 이미 들어 있을 수 있습니다.

<a id="provider-setup"></a>

## 제공업체 설정

### Memorix

```sh
npm install --global memorix@1.3.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix는 LLM이나 임베딩 서비스 없이 로컬 휴리스틱 모드로 동작합니다. 선택적 제공업체는 Memorix 자체의 `~/.memorix/config.toml` 또는 프로젝트의 `memorix.toml`에서 설정하세요. 이 예시는 DSH 작업 디렉터리에서 얻은 Memorix의 Git 프로젝트 식별을 유지하고, Memorix의 기본값인 `~/.memorix/data`를 사용합니다. 변경하려면 DSH를 시작하기 전에 `MEMORIX_DATA_DIR`을 설정하세요.

### MCP Reference Memory

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

이 참조 서버는 로컬 지식 그래프를 저장하고 엔티티, 관계, 관찰, 읽기, 검색, 열기 도구를 제공합니다. 모델이나 임베딩 서비스는 필요하지 않습니다. 이 예시는 설치된 npm 패키지 디렉터리 대신 `$HOME/.dsh-mcp-reference-memory.jsonl`에 JSONL을 저장합니다. 변경하려면 DSH를 시작하기 전에 `MEMORY_FILE_PATH`를 설정하세요.

검색은 엔티티 이름, 유형, 관찰 내용에 대한 대소문자를 구분하지 않는 부분 문자열 일치이며 의미 검색이 아닙니다. 서버는 임베딩, 자동 요약, 충돌 해결, 망각 정책을 추가하지 않습니다.

### Engram

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram이 저장소와 프로젝트 선택을 관리합니다. 기본적으로 `~/.engram`을 사용하고 DSH 작업 디렉터리에서 Git 프로젝트를 감지하며, `ENGRAM_DATA_DIR` 또는 `ENGRAM_PROJECT` 환경 변수로 재정의할 수 있습니다.

<a id="optional-shared-model-instruction"></a>

## 선택적인 공통 모델 지침

서버의 도구 설명만으로 메모리 사용이 안정적으로 유도되지 않는다면 기존 모델 지침에 다음의 짧고 공급업체에 종속되지 않는 지침을 추가하세요:

> 사용자가 무언가를 기억해 달라고 요청하면 메모리 쓰기 도구를 호출하세요. 과거 정보가 관련될 수 있다면 메모리를 검색하고 관련 결과를 사용하세요.

이는 추가 지침일 뿐입니다. 이 예시들은 DSH의 시스템 프롬프트 페르소나를 대체하지 않습니다.

<a id="verify-write-fresh-session-recall-and-use"></a>

## 쓰기, 새 세션에서의 회상, 활용 확인

고유한 값 하나를 사용하고 전체 과정에서 제공업체의 저장 범위를 유지하세요:

1. DSH 세션 A에서 `Remember that my validation drink is lapsang-<unique suffix>.`라고 요청하세요. 모델이 제공업체의 쓰기 도구를 호출하고 도구가 성공을 반환했는지 확인하세요.
2. 같은 실행 중인 Host에 DSH 세션 B를 만드세요. 세션 A의 대화는 복사하지 마세요. `What is my validation drink? Check memory.`라고 요청하세요. 모델이 제공업체의 검색 또는 회상 도구를 호출하고 해당 값을 반환했는지 확인하세요.
3. 세션 B에서 계속 `Use that preference to suggest one drink for the meeting.`라고 요청하세요. 답변이 회상한 값을 사용하는지 확인하세요.

새 DSH 세션은 필요하지만 Host 재시작은 필요하지 않습니다. MCP 자식 프로세스가 충돌하면 백오프를 적용한 자동 재연결과 도구 재동기화가 수행됩니다. 도구는 목록에 유지되고 장애 중에만 호출이 실패합니다. 재연결 시도 한도를 소진하면 도구 등록이 해제되며 다시 로드하거나 재시작할 때까지 재연결이 중단됩니다. 초기 검색은 비동기이므로 첫 검증 프롬프트를 보내기 전에 제공업체의 `mcp__...` 도구가 나타날 때까지 기다리세요.

<a id="bring-another-mcp-server"></a>

## 다른 MCP 서버 연결

같은 항목 필드를 복사하고 고유한 `id`와 `serverName`을 사용하세요:

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

원격 서버에는 대신 `transport: streamable-http`, `url`, `headers`를 사용하세요. 제공업체별 설치, 식별, 인증, 모델, 임베딩, 영속성, 라이선스는 해당 제공업체의 책임입니다.
