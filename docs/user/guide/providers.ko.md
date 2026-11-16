<a id="configure-models"></a>

# 모델 구성

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | [日本語](providers.ja.md) | [Español](providers.es.md) | [Français](providers.fr.md) | [Deutsch](providers.de.md) | [Português](providers.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

이 가이드는 [개발 가이드](../../development.md)에 따라 웹 UI를 시작한 상태를 전제로 합니다. 모델 변경은 서버를 다시 시작할 필요 없이 다음 요청부터 적용됩니다.

<a id="configure-deepseek"></a>

## DeepSeek 구성

**설정 → 모델**을 엽니다. DeepSeek 카드에는 API 키 입력란이 하나 있습니다. 키를 입력하고 저장하세요.

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

키는 쓰기 전용입니다. 저장 후 페이지에는 민감한 값을 가린 설명만 전달되며, 비밀값 자체는 반환되지 않습니다. 키는 `$DSH_HOME/.credentials.yaml`에 저장되고 설정에는 해당 자격 증명에 대한 참조만 남습니다.

저장된 키와 기본 엔드포인트로 DeepSeek의 모델은 DeepSeek API 게시 목록을 따릅니다. 모델이 먼저 필요로 할 때 목록로드는 사용중인 동안 10 분마다 배경에 새로 고침하고로드 할 수없는 경우 내장 모델로 돌아갑니다. 관련 기사 **모델 번호:** 이름 \* **사용자 정의 설정** 대신 자신의 목록을 유지하고 게시 된 것을 중지합니다. **기본값 복원** 다시 그것을 다시로드합니다. 게시 된 목록이 사용 중이지만, 카드는 내장 모델을 보여줍니다, 그래서 새로 출판 된 모델은 모델 선택기에 만 나타납니다. [API 키 공급자 참고](../../../packages/llm/llm-deepseek-api-key/README.md) 목록을 소유하고, fallback 및 gating 규칙.

<a id="add-a-third-party-provider"></a>

## 제3자 공급자 추가

제품 정보 **모형 공급자를 추가하십시오**. 카드는 위에 열립니다 **제3자 모델 제공**: 공급자 dsh 배를 선택 - 목록 쇼 공급자 ids와 같은 `anthropic`, `openai`, `moonshotai` 김이, 또는 `zai` GLM의 경우 - API 키를 입력하고 저장합니다. 설치된 카탈로그는 엔드포인트, 프로토콜 및 모델 목록을 제공합니다.

인증 **?** 는 저장성 우선 순위 및 환경이 내리는 것을 설명합니다. 저장된 자격 증명을 사용하거나 목록으로 만들어진 환경 변수를 사용하도록 키 공백을 남겨두십시오. 녹색 힌트는 검출 된 환경 변수를 식별합니다. 노란색 힌트는 credential 변수가 감지되지 않습니다. API 키 입력하거나 목록 변수를 구성합니다. unconfirmed hint는 상태가 실패한 것을 의미합니다. 탐지는 credential를 유효하지 않거나 연결을 시험하지 않습니다. AWS 프로파일 및 Google 애플리케이션 기본 자격 증명을 포함한 제공 자격 증명 파일,이 체크 아웃 밖에 있습니다. `openai-codex`와 같은 기본 키 인증이없는 공급자는 프로파일이 명시적으로 자격 증명 참조를 지명하지 않는 한 키 필드를 표시하지 않습니다.

저장된 자격은 입력 및 저장된 키가 사용될 수있는 녹색 힌트의 마스크 미리보기를 표시합니다. 미리보기는 첫 번째 하이픈 또는 밑줄 전에 식별자를 유지, 다음 5 개의 주요 및 4 개의 추적 키 문자, 적어도 8 개의 중간 문자가 숨겨져있을 때; 그렇지 않으면 전체 키와 식별자는 점이된다. 계산은 Unicode 코드 포인트를 사용합니다. 저장된 키에는 눈 버튼이 없으며, 복사, 잘라, 또는 부분적으로 편집 할 수 없습니다. 입력 또는 붙여넣기 전체 키를 대체합니다. Backspace 또는 단계 전체 키 제거 삭제. Backspace 또는 삭제를 누르면 **가 저장 된 오버라이드 및 사용 환경 인증을 제거하기 위해**를 적용합니다. 교체를 빈다 또한 저장 된 키의 deletion을 단계. **는** 가 저장하기 전에 저장된 키를 보존합니다. 삭제 취소는 변경되지 않습니다. 키가 제거되었지만 설정이 실패하면, 삭제가 undone이 될 수 없다는 경고 보고서; 재try **는** 를 설정 완료, 또는 **는** 가 부분 결과를 남길 수 있습니다. 공유 자격 증명을 정리하면 동일한 참조를 사용하여 모든 기능에 영향을 미칩니다. 환경 증명 없이, 공급자는 명확하게 한 후에 입증이 없습니다. 환경 fallback는 **입력이 비어있는 동안 auth** 및 1개의 탐지 힌트로 env를 사용하도록 공백을 남겨 둡니다. 교체 초안은 새로운 키를 적용하는 알림을 보여줍니다. Pending removal names the environment variable used after apply, when the route 선언 한 것. 다른 비empty 입력은 인증 상태 텍스트를 표시하지 않습니다. 주소 구성 변수는 **기본 URL** 아래에 나타나고 자격 증명으로 계산하지 않습니다.

편집 가능한, 비비싼 키 초안은 눈 버튼이 있습니다. **쇼 비밀** 를 선택하여 입력한 것을 확인하고 **는 비밀** 를 다시 마스크로 만듭니다. 입력 마스크를 다시 변경합니다. 네이티브 암호 필드는 절단을 제공하지 않습니다. 초안을 선택하고 Backspace를 눌러 절단하기 전에 표시하십시오. 저장된 자격은 쓰기 만 남아 있습니다.

<a id="add-a-custom-model-api"></a>

## 사용자 정의 모델 API 추가

카드를 켜기 **사용자 정의 모델 API** 릴레이, 회사 게이트웨이, 자체 호스팅 서버, 또는 설치된 카탈로그에서 모든 공급자의 부패. 낮은 케이스 공급자 ID, 기본 URL, API 프로토콜, 자격 증명, 그리고 적어도 하나의 모델을 공급. **API 프로토콜** 게이트웨이가 말하는 것을 하나 이어야하며, 4가지를 제공합니다: OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, Gemini API, Active Profile's에 저장 `cordis.patch.yml` 이름 \* `openai-completions`, `openai-responses`, `anthropic-messages`, 및 `google-generative-ai`. Gemini API 기본 URL에는 API 버전이 포함되어 있습니다. `https://gateway.example/v1beta`. 공급자는 1개의 의정서를, 그래서 2개의 필요를 2 공급자 봉사하는 출입구를 말합니다.

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

제공자 ID는 요청, 저장된 세션, 모델 기본 및 자격 참조가 사용되기 때문에 영구적입니다. 공급자 이름을 바꾸려면 새로운 공급자를 추가하고 오래된 것을 삭제하십시오. 디스플레이 이름, 기본 URL, 프로토콜, 자격, 모델은 편집할 수 있습니다.

<a id="discover-models"></a>

### 모델 찾기

이름 \* **모델 카탈로그**, 선택 **Fetch 사용 가능한 모델** 그것을 봉사하는 endpoint를 요청합니다. 요청은 기본 URL, 프로토콜 및 키는 현재 양식 또는 저장된 공급자의 저장된 키에 사용되며, 응답은 검색 가능한 피커를 엽니다. 목록에서 이미 검색된 모델은 검색을 시작하므로 모델을 추가하여 제거 할 수 있습니다. 선택하고 선택 **업데이트 목록**. 구성 모델 endpoint는 목록 숙박하지 않습니다. 당신이 저장하거나 공급자를 만들 때까지 아무 것도 저장되지 않습니다.

Discovery는 목록 형식 일반적인 게이트웨이 게시를 읽습니다. 그러나 모든 엔드포인트 답변이 아니라 보증보다는 편의를 다룹니다. 실패하거나 목록이 아무것도 없을 때 모델이 손을 추가하고 그들은 똑같습니다. 내장된 공급자는 항상 설치된 카탈로그에서 대답됩니다, 게이트웨이의 기본 URL 포인트가 될 때, 그래서 세관 공급자를 통해 운하가 실제로 봉사하는 것을 볼 수 있습니다.

<a id="select-a-model"></a>

## 모델 선택

구성 공급자는 모델 선택기에서 나타났습니다. 모델을 선택하면 새로운 세션에 대한 기본이 됩니다. 이미 요청을 보낸 세션은 자체 로그에 기록된 모델을 유지합니다.

공급자의 모형 순서를 바꾸기 위하여는, **조정 → 모형**에서 그것을 편집하고, **주문을 받아서 만들어진 조정**를 열고, 모형의 3 선 손잡이를 끌기 위하여. 핸들을 집중하고 위로 또는 아래 화살표 키를 누릅니다. **는** 순서를 적용합니다; **는** 를 불이 켜집니다. 모델 피커는 그 공급자 안에 저장된 순서를 따릅니다.

저장된 기본 이름은 삭제 된 공급자 인 경우 작곡가가가 **모델을 선택** 및 다른 모델이 선택 될 때까지 입력 블록을 선택합니다.

<a id="advanced-configuration"></a>

## 고급 구성

생성 된 [플러그인 구성 카탈로그](../../config-catalog.md) 목록 모든 지원 필드 및 기본 모든 플러그인; [`dsh-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) 는 공급자 섹션이 페이지 구성입니다. [`dsh-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) 및 [`dsh-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) 참조 자체 직접 `cordis.patch.yml` 구성, 카탈로그 해상도, 소싱 컨트롤, 자격 증명, 어댑터 오류.

::: 팁 추가 설정 모델 페이지는 API 키, 디스플레이 이름, 기본 URL, API 프로토콜 및 각 모델의 ID, 디스플레이 이름, 컨텍스트 창, 최대 출력 토큰 및 입력 유형, 사용자 정의 모델 API 공급자의 모델의 소원 레벨을 노출. 내장 공급자의 모델, 요청 호환성 스위치, 헤더, 타임아웃, 그리고 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`의 재량 정책의 이유를 구성, 같은 문서 페이지 쓰기. 브라우저가 서버와 동일한 기계에서 실행될 때 직접 수정하거나, 설정 헤더에 **오픈 구성 파일** 로 열 수 있습니다; 어댑터는 다음 요청에 다시 보았으므로 재시작이 필요 없습니다. 아래의 하위 섹션은 대부분의 게이트웨이가 필요합니다.

표준 웹 UI 실행을 위해 `dsh web`, `<profile>` 는 `web`, 그래서 경로는 `$DSH_HOME/profiles/web/cordis.patch.yml`. 사용자 정의 프로파일을 실행하면, 대신 시작된 이름을 사용합니다. :::

<a id="image-input"></a>

### 이미지 입력

으로 **설정 → 모델**, 공급자를 편집하고, 엽니다 **사용자 정의 설정**, 모델의 확장 **모델 옵션**. **입력 유형** 용량 필드 아래에 자신의 행을 점유합니다. 선택 **의 의 의** 이미지를 수용하고 저장하는 모델에 대해. **이름 \*** 상속 이미지 기능 없이 새로운 사용자 정의 모델에 대한 선택 시작. 적어도 하나의 유형은 선택되어야한다; 이미지 전용 모델에 대한 텍스트를 정리하기 전에 이미지를 선택하십시오.

체크박스 저장 `input` pi-ai 모델 및 `inputModalities` 직접 DeepSeek 어댑터에 대 한. 또한 모델을 편집할 수 있습니다. `$DSH_HOME/profiles/<profile>/cordis.patch.yml`; 예를 들면, 이 주문 pi-ai 공급자는 1개의 원본 전용 모형 및 1개의 시각 모형을 선언합니다:

이 예제는 프로파일 패치 내부 구성 필드를 보여줍니다. Cordis config override는 완전한 항목 구성을 대체합니다. 기존의 오버라이드를 편집 할 때 다른 공급자와 필드를 보존합니다.

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
            input: [text, image]
```

Pi-ai의 `input` 이름 \* `text` 으로 `image` 그리고 그 모형에 혼자 적용하십시오. 명시되지 않는 선택은 우선권을 가지고 갑니다. omitted 또는 빈 `input` 설치된 카탈로그의 입력 유형을 상속하고, 그 경로의 `defaultInput`, 기본적으로 `[text]`. 체크박스는 이 상속값을 저장하지 않고 행을 열 때 오버라이드를 저장합니다.

DeepSeek는 텍스트 전용으로 omitted `inputModalities` 를 치료하고 빈 목록을 거부합니다. 이미지 제거는 또한 DeepSeek가 원본 전용 모형에 이미지 한계를 주사하기 때문에 모형의 `imagePixelBudget` 및 `imageMaxBytes`를 제거합니다. 나중에 이미지를 활성화하고 사용자 정의 제한을 필요로한다면 그 제한을 다시 설정합니다.

체크 박스를 편집 한 후 상속을 복원하려면 모델의 `input` 또는 `inputModalities` 필드를 `cordis.patch.yml`. **복원 기본적으로** 는 다른 모델 편집을 포함한 전체 모델 카탈로그 오버라이드를 제거하므로 전체 카탈로그를 복원 할 때만 사용하십시오.

손으로 입력 한 모든 모델이 이미지를 가져 가면 각 경로에 한 번의 낙진을 설정하십시오.

```yaml
- id: llm-pi-ai
  config:
    providers:
      vision-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://vision.example/v1
        defaultInput: [text, image]
        models:
          - id: first-model
          - id: second-model
```

`defaultInput` fallback, override가 아닌, `[text]`에 기본값은 : 내장된 공급자에 해당 카탈로그에만 해당하지 않습니다. 그래서 카탈로그 모델에서 이미지를 제거하지 않습니다. 그 모델의 자신의 `input`와 그 중 하나를 좁은. 내장 공급자가 명시되지 않은 경우 `models` 목록, `modelOverrides`, 모델 ID로 키 입력 :

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

pi-ai 구성에서, 모든 목록은 모델의 자신의 `input`를 제외하고 적어도 하나의 modality를 입력해야합니다, 빈 목록은 그것을 omitting 것과 동일하게 의미. 알 수없는 modality는 기록되는 곳을 거부합니다.

두 필드는 체크 그것 보다는 오히려 당신의 endpoint에 관하여 주장합니다. 그것의 endpoint를 선언하는 모형은 여기에서 붙잡지 않습니다; 공급자는 대신 요청을 거부합니다.

<a id="deepseek-account-models"></a>

### DeepSeek 계정 모델

서명된 DeepSeek 계정은 계정 서비스에서 모델을 나열하므로 Models 페이지는 모델 편집기가 없습니다. 단일 모델을 사용하여 조정하십시오. `modelOverrides` 으로 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`; 필드는 DeepSeek 일치 `models` 입력 및 unset 필드는 목록 값 유지:

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

새로운 Ocean이 `CLIENT_UPGRADE_REQUIRED`로 실패한 모델은 설치하기 위해 버전 이름을 붙입니다. [계정 공급자 참고](../../../packages/llm/llm-deepseek-account/README.md) 는 목록, 낙하 및 조정 규칙을 소유합니다.

<a id="reasoning-effort"></a>

### 회사연혁

모델 피커는 **Effort** 메뉴를 제공합니다. 내장된 공급자의 모델은 설치된 카탈로그에서 레벨을 상속하고 DeepSeek의 모델은 어댑터의 레벨을 유지합니다. 손으로 입력 한 모델은 추가 할 때까지 아무도 선언하지 않고, 따라서 그 다음 Effort 항목은 메뉴에 나타나지 않으며 endpoint의 자체 기본은 모델이 생각 여부를 결정합니다.

사용자 정의 모델 API 공급자에, **설정 → 모델**에서 수준을 선언 : 공급자를 편집, **사용자 정의 설정**를 열고 모델의 **모델 옵션**를 확장하고 **Reasoning 레벨**를 켜십시오. 행은 오프, 낮은, 중간 및 높은 시작. 각 행은 **API 값** 로 레벨 이름을 기본으로 보냅니다. 모델 공급자의 API 문서가 서로 다른 수준에 매핑하는 경우에만 변경하십시오. endpoint가 지원되는 것을 일치하거나 삭제하는 줄을 추가하고, 적어도 1개의 수준을 따로따로 유지하고, 저장합니다. 스위치를 끄는 것은 선언을 제거합니다.

페이지 쓰기 `reasoningEfforts` 으로 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`또한 레벨을 직접 선언 할 수있는 곳 :

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        reasoning: high
        models:
          - id: my-reasoner
            reasoningEfforts:
              off:
              high: high
              max: max
```

각 열쇠는 수준 메뉴 제안이고, 그것의 가치는 `reasoning_effort`로 철사에 보내진 철자입니다, 그래서 `max: xhigh` 는 그것의 자신의 vocabulary를 가진 출입구를 위해 수평을 명명합니다. `off` 만 비어있을 수 있습니다. 대부분의 엔드포인트가 생각하지 않기 때문에 매개 변수의 부재입니다. route's `reasoning` 는 세션이 none을 선택하면서 사용 된 레벨입니다. Picker의 노력은 새로운 세션에 대한 기본으로 모델과 함께 저장합니다.

으로: `off` 왼쪽 빈은 아무것도 보내, 이는 요청에 생각하는 모델만 중지; `off` 값은 값이 값으로 전송한다. `reasoning_effort` 대신. OpenAI 호환 게이트웨이 뒤에 DeepSeek V4가 아닌지 생각하지 않는 모델, 예를 들어 — 필요 `compat.thinkingFormat: deepseek`, 이는 `off` 이름 \* `thinking: {type: disabled}` 그리고 다른 모든 수준은 보냅니다 `thinking: {type: enabled}` 노력의 옆에:

```yaml
        models:
          - id: deepseek-v4-pro
            compat:
              thinkingFormat: deepseek
            reasoningEfforts:
              off:
              high: high
              max: max
```

게이트웨이가 그 수준을 잃지 않는 내장 공급자의 모델 `reasoningEfforts: false` 이름 \* `modelOverrides`; 그 다음에 대한 노력 선택은 거부 `UNSUPPORTED_REASONING_EFFORT`. DeepSeek의 자신의 노선은 이의 아무 것도 필요로 합니다: 그것의 모형은 이미 제안합니다 `off`, `low`, `high`, 및 `max`, 및 `llm-deepseek.reasoningEffort` 기본값을 설정하면 픽업 시작:

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### 관련 문의

게이트웨이는 도달 가능한 주소에서 작업 키를 잡고 여전히 모든 요청을 거부 할 수 있습니다. pi-ai는 시스템 프롬프트를 운반하는 요청의 모양을 결정합니다. 이 필드는 출력을 캡, endpoint의 URL에서 사고 수준 여행 -, 그리고 OpenAI 자체로 인식되지 않는 주소는 인식되지 않습니다. 대부분의 OpenAI 호환 게이트웨이는 최소 1가지 OpenAI가 허용됩니다.

두 계정의 대부분입니다. 이유를 선언하는 모델은 `role: "developer"`로 전송 된 시스템 프롬프트를 가지고 있으며, 많은 게이트웨이가 비난을 거부하고 출력 캡은 `max_completion_tokens`로 전송됩니다. 이는 `max_tokens` 가 거부하는 서버입니다. 양식에는 필드가 없습니다. 경로에 수정하십시오. `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        compat:
          supportsDeveloperRole: false
          maxTokensField: max_tokens
        models:
          - id: my-model
```

경로의 `compat` 는 모델의 기본이며, 필드에 의해 모델의 자신의 승리 필드를 설정할 수 있으므로, 하나의 모델은 루트를 복원하지 않고 수정 될 수 있습니다.

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

그 모델에 대한 설치된 카탈로그의 가치를 설정하지 않고 카탈로그가 pi-ai의 탐지에 떨어지지 않는 것을 설명하지 않습니다. 모든 스위치가 값을 지정합니다: 키 왼쪽 빈 (`supportsDeveloperRole:`)는 무시하지 않고, 빈 값이 카탈로그가 알기 때문에 그 자리에서 아무것도 말하지 않는 것을 지우기 때문입니다. name no protocol accepts isjected too, and the message lists that are available.

각 스위치는 선언하는 프로토콜에 속한다, 그래서 하나의 `api` 에 유효한 스위치는 다른에 거부 될 수있다 — 그 프로토콜이 제공하는 메시지 이름. 위의 `input` 와 마찬가지로, 스위치는 확인보다 끝점에 대해 주장합니다. 게이트웨이를 설정하면 실제로 다른 요청을 보낼 필요가 없습니다.

모든 스위치, 허용된 값, 그리고 그것을 가지고 가는 의정서는 아래에 목록으로 만들어집니다 `PiAiCompatProfile` 으로 [제품정보 `dsh-llm-pi-ai` 설정 참조](../../config-catalog.md#oceanocean-llm-pi-ai) — 소스에서 파생되는 것은, 그래서 어댑터가 받아들일지 뒤에 떨어질 수 없습니다.

<a id="troubleshooting"></a>

## 관련 상품

- **`MISSING_CREDENTIAL`** — Models 페이지를 통해 공급자 키를 저장하거나 참조된 환경 변수를 공급합니다.
- **`UNKNOWN_MODEL`** - 구성 된 모델을 선택하거나 사용자 정의 공급자에 누락 된 모델을 추가하십시오.
- **사용할 수 있는 모델 반환 401** — 키 확인. 모델 발견은 OpenAI 호환 `GET /models` 엔드 포인트를 호출; 그것을 제공하지 않는 엔드 포인트에 대 한 모델을 수동으로 입력.
- **사용할 수 있는 모델은 `data` 배열과 `models` 객체** 를 보고하지 않습니다. 엔드포인트의 목록은 형식의 발견이 읽지 않습니다. 손으로 모델을 입력하세요.
- **게이트웨이는 키와 URL이 오른쪽** 이지만 모든 요청을 거부합니다. 이 요청은 OpenAI와 다릅니다. 루트에서 `compat.supportsDeveloperRole: false` 및 `compat.maxTokensField: max_tokens` 로 시작하십시오.
- **모델만** 실패 — pi-ai는 게이트웨이가 거부하는 `developer` 역할로 시스템 프롬프트를 보냅니다. 설정 `compat.supportsDeveloperRole: false`.
- **Effort 메뉴는 손으로 입력 한 모델에 나타나지 않습니다** - 그것은 레벨을 선언합니다. 사용자 정의 모델 API 제공 업체에서 **Reasoning 레벨** 모델의 **모델 옵션**로 전환하십시오. 다른 곳에서 `reasoningEfforts` 를 모델에 추가하십시오. `cordis.patch.yml`.
- **`off` 생각** 에서 DeepSeek 모델을 멈추지 않습니다. 빈 `off` 는 모든 분야에서 아무 이유도 보내지 않으며, 기본적으로 생각을 유지하는 엔드포인트가 있습니다. 모델이나 경로에 `compat.thinkingFormat: deepseek` 를 설정합니다.
- **compat 스위치는 값** 가없는 것으로 거부됩니다. 대장 후 아무것도 기록 된 키. 값을 부여하거나 설치 된 카탈로그를 유지하기 위해 키를 제거하십시오.
- **이미지는** 를 보내기 전에 거부됩니다. 모델은 이미지의 형태를 선언하지 않습니다. 사용자 정의 공급자의 모델 `input: [text, image]`를 제공; DeepSeek의 자신의 경로에, 구성 된 카탈로그 (기본적으로`deepseek-flash` )에서 이미지 캡처 가능한 항목을 선택하고 게이트웨이가 이미지 입력으로 모델을 제공한다는 것을 확인합니다.
- **공급자는 이미지** 를 나르는 요청을 거부합니다. 모델은 최종 지점을 실제로 제공하지 않습니다. `image` 를 제거하면, 이 목록에서 부여됩니다. 모델의 `input`또는 경로의 `defaultInput` - 다음 새로운 세션을 시작합니다. 첨부된 이미지는 세션 로그에서 유지되므로 세션이 꺼질 때까지 동일한 요청 반복합니다.
