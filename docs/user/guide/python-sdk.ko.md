<a id="get-started-with-the-python-sdk"></a>

# Python SDK로 시작

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

이 튜토리얼은 이 저장소의 소스에서 Python SDK를 구축하고, 출하된 독립 미니 프로파일을 실행하고, 자신의 프로그램에서 동일한 `dsh` 프로필을 사용자 정의하는 방법을 보여줍니다. Ocean은 npm 또는 PyPI SDK 배포가 아직 없습니다.

<a id="prerequisites"></a>

## 관련 상품

- 파이썬 3.10 또는 더 새로운
- 뚱 베어
- Linux x64, Linux arm64, macOS 14 또는 arm64, 또는 Windows x64에 더 새로운
- DeepSeek 호환 API 엔드포인트 및 자격
- 고립 된 업무 공간과 고립 된 Ocean home

<a id="build-the-sdk-from-source"></a>

## 소스에서 SDK 구축

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

공개 레지스트리가 자격이 된 Ocean SDK를 호스팅하지 않습니다. PyPI의 `deepseek-harness-sdk` 를 설치하면 donor 프로젝트의 패키지가 아닌 Ocean이 아닙니다. 이 체크 아웃에서 런타임 캐리어와 휠을 모두 빌드하면 가상 환경에 설치합니다.

::: 코드 그룹

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

선택하기 `--platform` 가치와 일치 `dist-exe/` 당신의 기계를 위해 실행할 수 있는: `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64`, 또는 `win-x64`; 그것의 본래 건축술에 각 표적을 건설하십시오. 임명은 일치한 원동태 런타임 바퀴 및 포함합니다 `dsh` 명령. Normal SDK 실행은 시스템 Node.js가 필요하지 않습니다. [Python contributor 워크플로우](../../../python/development.md) 정확한 파일명, 유효성, 이 빌드 단계에 대한 릴리스 체크를 소유합니다.

<a id="run-the-checked-in-example"></a>

## 체크 인 예제를 실행

자격 증명 및, 필요한 경우, 호환 프록시 엔드포인트:

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

::: 코드 그룹

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

명시된 작업 공간과 홈 경로로 하나의 작업을 실행:

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

::: 코드 그룹

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

스크립트는 최종 조수 응답 또는 선택한 프로필에 의해 공급된 명령 결과를 인쇄합니다. 선택한 홈은 생성 된 `sdk-minimal` 프로필을 수신하고 플러그인을 설치하고 `sessions/`아래 JSONL 세션 로그를 압축합니다. 예를 들어, SDK는 침묵적으로 읽지 않습니다. `~/.dsh`.

<a id="use-the-sdk-in-your-program"></a>

## 프로그램에서 SDK 사용

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

SDK는 번들 `dsh --profile sdk-minimal` 프로세스를 시작으로 컨텍스트 관리자 종료까지 재사용합니다. 프로필, 그것의 지속 패치, 홈 패치, 어떤 주문 `patches` 튜플 응용 구성을 형성. 별도의 Python runtime bin 또는 완전한 설정 옵션이 없습니다.

<a id="install-or-define-plugins"></a>

## 플러그인 설치 또는 정의

제품 정보 `dsh plugin` 이 가정에서 persist해야 하는 의존도와 뭉치 층을 위해:

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

::: 코드 그룹

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

첫 번째 명령은 출하된 독립 프로파일을 초기화합니다. `pnpm`에 두 번째 운송 패키지 관리, 다음 `dsh.bundle` 레이어를 내보내는 모든 설치 패키지를 기록합니다. 이 관리 명령에만 `pnpm` 설치; 설치된 SDK를 실행하면 필요하지 않습니다. 지속적인 행 변경을 위해 `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` 를 편집하거나, 파이썬에서 패치 파일을 per-launch 변경합니다.

또 다른 `profile` 는 `@ocean/ocean-sdk-app` 또는 다른 JSON-RPC 서버 행을 포함할 때 유효합니다. 서버 행을 누를 때, 해결되지 않은 플러그인 및 잘못된 패치는 다른 구성으로 떨어지는 대신 시작 중에 실패합니다.

<a id="opt-in-to-str_replace_editor"></a>
### 옵트아웃 `str_replace_editor`

번들 된 실행 시간은 `str_replace_editor`를 포함하지만 `sdk-minimal` 는 기본 Cordis 나무에서 그것을 미끼. 그것을 사용하려면 `editor.patch.yml`; `insert` 로이 구성을 기존 파일 시스템 공급자를 사용하여 편집기를 추가합니다.

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

패스워드 `patches=("/absolute/path/to/editor.patch.yml",)` 건설시 `DeepSeekHarness(profile="sdk-minimal", ...)`, 또는 패치를 넣어 `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` persistent 윤곽을 위해. 다음 실행 시작에, 모델 요청은 포함 `str_replace_editor` 기본 도구 옆에. 로컬 파일 시스템 공급자는 상대 경로에 대한 실행 시간 작업 디렉토리를 사용합니다. 최소 쉘과 같은, 그것은 그 디렉토리에 confine 액세스하지 않습니다. 동일한 패치는 표준과 함께 작동합니다. `sdk` 제품 설명

<a id="enable-team-mode"></a>
### Enable 팀 모드

에이전트 팀에 대한 표준 `sdk` 프로필을 사용하십시오. `sdk-minimal` 는 시약이나 팀 서비스를 포함하지 않습니다. [팀 패치](../../../apps/cli/config/examples/team-mode.yml) 를 사용하여 저장하십시오. `team-mode.yml`:

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

SDK의 절대 경로 전달 `patches` 옵션과 `profile="sdk"`. Python 사용 `patches=("/absolute/path/to/team-mode.yml",)`; TypeScript 사용 `patches: ["/absolute/path/to/team-mode.yml"]`. 패치는 대체합니다 `agent-team` 행 전체적인 윤곽, 그래서 어떤 관례든지 포함하십시오 `maxTasks` 동일한 매핑에 제한.

새로운 루트 세션을 만들고 공유 작업을 작성하고 나열하도록 요청하십시오. 첫 번째 모델 요청은 팀 도구 및 협업 지침을 포함합니다. 루트는 모드를 저장하고, subagents는 그것을 공유합니다. 기존 세션을 복원하는 것은 명시적으로 설정되지 않았거나 활성화되지 않은 경우에도 모드를 보존합니다. 이 패치를 변경하거나 제거하지 않는 것은 저장된 선택이 아닙니다. [팀 서비스 참조](../../../packages/team/agent-team/README.md#use-this-package) 모드 및 작업 semantics.

<a id="understand-the-minimal-profile"></a>

## 최소 프로필에 대한 이해

| 재산 | 가치 |
|---|---|
| 체계 신속한 | `DSH_SYSTEM_PROMPT`의 하락 뒤로 `You are a helpful software engineer assistant.` |
| 모형 안으로 `minimal.py` | `--model`, 다음 `DSH_MODEL`, 다음 `deepseek-v4-flash` |
| Model-facing 도구 | 관련 제품 `bash` Linux/macOS 또는 `pwsh` Windows에서, `read_image`, 및 `working_directory` |
| 포탄 timeout | 300 초 |
| 선택적인 런타임 컨텍스트 | Absent |
| Context compaction | 자동; 추가 모델 요청을 통해 이전 역사를 요약 |
| Session persistence | JSONL을 언압 `<dsh_home>/sessions` |

프로파일의 유일한 번들 빈 루트에 완전한 트리를 삽입하고 `dsh-base`를 포함하지 않습니다; 나중에 기본 프로파일 도구는 따라서 implicitly 나타날 수 없습니다. 그것은 SDK 프로토콜, 하나의 환경 구성 DeepSeek 어댑터, 로컬 실행 및 persistence, 텍스트 파일 도구, 설정, 관리 자격 증명, OTel telemetry, 웹 도구, 하위 시약 및 로컬 명령어 발견은 absent입니다. [DeepSeek 세션 로그 기여자](../../../packages/session/session-log-deepseek/README.md) 는 기본적으로 DeepSeek 요청을 사용하여 로그 이벤트를 압축 해제, 요청에 따라 대부분의 `maxBytes` (8 MiB); 설정 `session-log-deepseek.enabled: false` 프로필 패치에서 비활성화. 그것은 `danger-full-access`를 핀으로 꼿습니다, 그래서 플랫폼 선택된 지속성 포탄은 가동불능시간에 보이는 어떤 경로든지 수정할 수 있습니다; 처분할 수 있는 체크 아웃 또는 콘테이너를 사용하십시오.

이미지 판독은 이미지 캡블 경로가 필요합니다. 자동적인 조밀함은 완전한 회의 통나무를 보존합니다; 모형과 저장 효력을 위한 [뭉치 참고](../../../packages/bundle/sdk-minimal/README.md) 를 보십시오. 이 `sdk-minimal` 구성에서 지원되지 않은 슬래시 입력은 일반 프롬프트 텍스트 남아있다.

설치된 바퀴는 아직도 가득 차있는 포장합니다 `web` 프로필 및 프론트엔드 자산. 실행 `dsh web` 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 의 `DSH_HOME` Python SDK 배포가 브라우저 애플리케이션을 필요로 할 때; `web` 별도의 CLI 애플리케이션이며 Python SDK 클라이언트를 사용할 수 없습니다.

프로필, 플러그인, 자격 증명, 설정 및 세션이 격리되어야 할 때 신선한 가정을 사용하십시오. 독립적 인 작업을 위해 신선한 세션 ID를 사용하십시오. 하네스, 홈 및 ID를 사용하여 동일한 내구성 대화 및 세션 소유 리소스를 계속하십시오.

의 특징 [뭉치 참고](../../../packages/bundle/sdk-minimal/README.md) 정확한 나무를 소유하고, [예 참고](../../../python/sdk/examples/README.md) runnable 프로그램을 소유합니다. The [Python SDK 참조](../../../python/sdk/README.md) Lifecycle, 결과, 알림 및 저수준 행동을 다룹니다. [dsh CLI 참고](../../../apps/cli/reference/README.md) 층을 덮는 단면도를 커버하십시오.
