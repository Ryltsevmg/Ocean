<a id="use-the-web-ui"></a>

# Web UI 사용하기

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | [日本語](index.ja.md) | [Español](index.es.md) | [Français](index.fr.md) | [Deutsch](index.de.md) | [Português](index.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

[루트 README](../../development.md)를 따라 Web UI를 시작하면 명령이 URL을 출력합니다. 이 가이드는 서버가 실행 중인 상태에서 시작합니다. `dsh` 프로세스는 실행한 디렉터리를 기본 파일 시스템 위치로 사용하지만, 처음 연 Web UI에는 워크스페이스를 추가하기 전까지 선택된 워크스페이스가 없습니다.

<a id="configure-a-model"></a>

## 모델 설정

**설정 → 모델**을 열고 모델 제공업체를 선택하세요. [모델 설정 가이드](./providers.ko.md)에서 지원되는 제공업체와 사용자 지정 OpenAI 호환 엔드포인트를 설명합니다. DeepSeek 경로를 사용한다면 [DeepSeek API 키](https://platform.deepseek.com/)를 입력하고 저장하세요. 서버를 재시작하지 않아도 모델 경로를 즉시 사용할 수 있습니다.

<a id="choose-a-workspace"></a>

## 워크스페이스 선택

**워크스페이스 선택**을 누르고 `dsh`를 시작한 프로젝트 디렉터리를 추가한 뒤 선택하세요. 워크스페이스를 선택하기 전에는 세션 입력란을 사용할 수 없습니다.

<a id="run-a-task"></a>

## 작업 실행

세션을 시작하고 다음 메시지를 보내세요:

> 이 저장소를 요약하고 주요 패키지를 알려 줘.

에이전트는 워크스페이스 파일을 읽고 편집하며, 명령을 실행하고, 작업을 위임하고, 계획을 관리할 수 있습니다. Web UI는 활성 권한 정책에서 승인이 필요한 작업을 수행하기 전에 사용자에게 확인합니다.

<a id="continue"></a>

## 다음 단계

- [모델 설정](./providers.ko.md)
- [네트워크 프록시 설정](./network-proxy.ko.md)
- [MCP 메모리 사용](./mcp-memory.ko.md)
- [알림 예약](./schedule.ko.md)
- [Python SDK 사용](./python-sdk.ko.md)
- [리버스 프록시 뒤에 Web UI 게시](./public-deployments.ko.md)
- [Ocean Desktop 제거](./desktop-uninstall-cleanup.ko.md)
- [다른 CLI 모드 사용](../../../apps/cli/README.md)
- [플러그인 개발](../develop/basic/index.md)
