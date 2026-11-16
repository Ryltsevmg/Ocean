<a id="get-started-with-the-python-sdk"></a>

# Python SDK 시작하기

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

이 실습에서는 저장소의 소스로 Python SDK를 빌드하고, 함께 제공되는 독립 실행형 최소 프로필을 실행합니다. 같은 `dsh` 프로필을 자신의 프로그램에서 사용자 지정하는 방법도 다룹니다. 검증을 거친 Ocean SDK 배포판은 아직 npm이나 PyPI에서 제공되지 않습니다.

<a id="prerequisites"></a>

## 관련 상품

- 파이썬 3.10 또는 더 새로운
- 뚱 베어
- Linux x64, Linux arm64, macOS 14 또는 arm64, 또는 Windows x64에 더 새로운
- DeepSeek 호환 API 엔드포인트와 자격 증명
- 다른 환경과 분리된 워크스페이스 및 Ocean 홈

<a id="build-the-sdk-from-source"></a>

## 소스에서 SDK 빌드하기

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

공개 레지스트리에는 검증된 Ocean SDK가 없습니다. PyPI에서 `deepseek-harness-sdk`를 설치하면 원본 프로젝트의 패키지를 받습니다. 이 체크아웃에서 런타임 실행 파일과 두 wheel을 모두 빌드해 가상 환경에 설치하세요.

::: code-group

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

컴퓨터에 해당하는 `--platform` 값과 `dist-exe/`의 실행 파일을 선택하세요. 지원되는 값은 `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64`, `win-x64`입니다. 각 대상은 해당 네이티브 아키텍처에서 빌드합니다. 설치에는 해당 플랫폼의 런타임 wheel과 `dsh` 명령이 포함됩니다. SDK를 일반적으로 실행할 때 시스템 Node.js는 필요하지 않습니다. 정확한 파일 이름, 검증 방법, 릴리스 점검은 [Python 기여 절차](../../../python/development.md)를 참고하세요.

<a id="run-the-checked-in-example"></a>

## 저장소에 포함된 예제 실행하기

자격 증명을 환경 변수로 내보내세요. 필요한 경우 호환 프록시 엔드포인트도 내보냅니다.

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

::: code-group

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

워크스페이스와 홈 경로를 명시해 작업 하나를 실행하세요.

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

::: code-group

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

스크립트는 선택한 프로필이 제공하는 어시스턴트의 최종 응답이나 명령 결과를 출력합니다. 지정한 홈에는 생성된 `sdk-minimal` 프로필과 설치된 플러그인이 들어가고, `sessions/` 아래에는 압축하지 않은 JSONL 세션 로그가 저장됩니다. 예제와 SDK는 `~/.dsh`를 암묵적으로 읽지 않습니다.

<a id="use-the-sdk-in-your-program"></a>

## 자신의 프로그램에서 SDK 사용하기

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

SDK는 필요할 때 함께 제공된 `dsh --profile sdk-minimal` 프로세스를 시작하고, 컨텍스트 관리자를 종료할 때까지 재사용합니다. 프로필, 프로필의 영구 패치, 홈 패치, 지정한 경우 순서대로 적용되는 `patches` 튜플이 앱 구성을 이룹니다. 별도의 Python 런타임 실행 파일이나 전체 구성 지정 옵션은 없습니다.

<a id="install-or-define-plugins"></a>

## 플러그인 설치 또는 정의하기

이 홈에 계속 유지할 의존성과 번들 레이어는 `dsh plugin`으로 설치하세요.

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

::: code-group

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

첫 번째 명령은 함께 제공되는 독립 실행형 프로필을 초기화합니다. 두 번째 명령은 패키지 관리를 `pnpm`에 맡기고 `dsh.bundle` 레이어를 내보내는 설치 패키지를 기록합니다. `pnpm`은 이 관리 명령에만 필요합니다. 설치한 SDK를 실행할 때는 필요하지 않습니다. 항목을 영구적으로 변경하려면 `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml`을 편집하세요. 실행할 때마다 다르게 설정하려면 Python에서 패치 파일을 넘기세요.

`@ocean/ocean-sdk-app`이나 다른 JSON-RPC 서버 항목이 포함된 다른 `profile`도 사용할 수 있습니다. 서버 항목이 없거나 플러그인을 찾지 못하거나 패치가 잘못된 경우, 다른 구성으로 전환하지 않고 시작에 실패합니다.

<a id="opt-in-to-str_replace_editor"></a>
### `str_replace_editor` 활성화하기

번들 런타임에 `str_replace_editor`가 포함되어 있지만 `sdk-minimal`의 기본 Cordis 트리에는 등록되지 않습니다. 사용하려면 다음 구성을 `editor.patch.yml`로 저장하세요. `insert`는 기존 파일 시스템 제공자를 사용하는 편집기를 추가합니다.

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

`DeepSeekHarness(profile="sdk-minimal", ...)`를 만들 때 `patches=("/absolute/path/to/editor.patch.yml",)`을 전달하세요. 영구 설정으로 쓰려면 패치를 `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml`에 저장합니다. 다음 런타임 시작부터 모델 요청에 기본 도구와 함께 `str_replace_editor`가 포함됩니다. 로컬 파일 시스템 제공자는 런타임의 작업 디렉터리를 기준으로 상대 경로를 해석합니다. 최소 구성 셸과 마찬가지로 그 디렉터리 밖에도 접근할 수 있습니다. 표준 `sdk` 프로필에도 같은 패치를 쓸 수 있습니다.

<a id="enable-team-mode"></a>
### 팀 모드 활성화하기

에이전트 팀에는 표준 `sdk` 프로필을 사용하세요. `sdk-minimal`에는 하위 에이전트나 팀 서비스가 없습니다. [팀 패치](../../../apps/cli/config/examples/team-mode.yml)를 `team-mode.yml`로 저장하세요.

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

`profile="sdk"`와 함께 패치의 절대 경로를 SDK의 `patches` 옵션으로 전달하세요. Python에서는 `patches=("/absolute/path/to/team-mode.yml",)`을, TypeScript에서는 `patches: ["/absolute/path/to/team-mode.yml"]`을 사용합니다. 패치가 `agent-team` 항목의 설정 전체를 대체하므로, 사용자 지정 `maxTasks` 제한이 있으면 같은 매핑에 넣으세요.

새 루트 세션을 만들고 공유 작업을 생성해 목록을 보여 달라고 요청하세요. 첫 모델 요청에 팀 도구와 협업 지침이 포함됩니다. 루트 세션이 모드를 저장하고 하위 에이전트는 그 모드를 공유합니다. 기존 세션을 재개하면 명시적으로 껐거나 한 번도 활성화하지 않은 경우에도 기존 모드를 유지합니다. 이 패치를 변경하거나 제거해도 저장된 선택에는 영향이 없습니다. 모드와 작업 동작은 [팀 서비스 참조 문서](../../../packages/team/agent-team/README.md#use-this-package)를 참고하세요.

<a id="understand-the-minimal-profile"></a>

## 최소 프로필의 구성

| 항목 | 값 |
|---|---|
| 시스템 프롬프트 | `DSH_SYSTEM_PROMPT`. 설정하지 않으면 `You are a helpful software engineer assistant.` |
| `minimal.py`에서 사용하는 모델 | 우선순위대로 `--model`, `DSH_MODEL`, `deepseek-v4-flash` |
| 모델이 사용하는 도구 | Linux/macOS의 영구 `bash` 또는 Windows의 영구 `pwsh`, 그리고 `read_image`와 `working_directory` |
| 셸 시간 제한 | 300초 |
| 선택적 런타임 컨텍스트 | 없음 |
| 컨텍스트 압축 | 자동. 모델에 추가로 요청해 이전 기록을 요약합니다. |
| 세션 저장 | `<dsh_home>/sessions`에 압축하지 않은 JSONL로 저장 |

프로필의 유일한 번들이 빈 루트에 전체 구성 트리를 삽입합니다. `dsh-base`가 포함되지 않으므로 기반 프로필에 추가되는 도구가 자동으로 나타나지 않습니다. SDK 프로토콜, 환경 변수로 설정하는 DeepSeek 어댑터 하나, 로컬 실행, 저장 기능이 포함됩니다. 텍스트 파일 도구, 설정 관리, 관리형 자격 증명, OTel 텔레메트리, Web 도구, 하위 에이전트, 로컬 지침 탐색은 포함되지 않습니다. [DeepSeek 세션 로그 연동](../../../packages/session/session-log-deepseek/README.md)은 기본적으로 아직 수락되지 않은 로그 이벤트를 DeepSeek 요청에 첨부합니다. 한 요청당 최대 `maxBytes`(8 MiB)까지 첨부합니다. 끄려면 프로필 패치에서 `session-log-deepseek.enabled: false`를 설정하세요. 프로필은 `danger-full-access`를 고정으로 사용하므로, 플랫폼에 따라 선택된 영구 셸이 런타임에서 보이는 모든 경로를 수정할 수 있습니다. 일회용 체크아웃이나 컨테이너를 사용하세요.

이미지를 읽으려면 이미지 입력을 지원하는 모델 경로가 필요합니다. 자동 압축을 해도 전체 세션 로그가 유지됩니다. 모델과 저장에 미치는 영향은 [번들 참조 문서](../../../packages/bundle/sdk-minimal/README.md)를 참고하세요. 이 `sdk-minimal` 구성은 지원하지 않는 슬래시 입력을 일반 프롬프트로 처리합니다.

설치된 wheel에 전체 `web` 프로필과 프런트엔드 파일도 들어 있습니다. Python SDK 배포에 브라우저 앱도 필요하면 `DSH_HOME`을 명시하고 `dsh web`을 실행하세요. `web`은 별도 CLI 앱이며 Python SDK 클라이언트를 지원하지 않습니다.

프로필, 플러그인, 자격 증명, 설정, 세션을 분리하려면 새 홈을 사용하세요. 독립 작업에는 새 세션 ID를 사용하세요. 같은 영구 대화와 세션에 속한 리소스를 이어갈 때만 동일한 하네스, 홈, ID를 다시 사용하세요.

정확한 구성 트리는 [번들 참조 문서](../../../packages/bundle/sdk-minimal/README.md), 실행 가능한 프로그램은 [예제 참조 문서](../../../python/sdk/examples/README.md)를 참고하세요. [Python SDK 참조 문서](../../../python/sdk/README.md)는 수명 주기, 결과, 알림, 저수준 동작을 설명합니다. [dsh CLI 참조 문서](../../../apps/cli/reference/README.md)는 프로필의 레이어 구성을 다룹니다.
