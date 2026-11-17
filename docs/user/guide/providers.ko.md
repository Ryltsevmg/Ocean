<a id="configure-models"></a>

# 모델 설정하기

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | [日本語](providers.ja.md) | [Español](providers.es.md) | [Français](providers.fr.md) | [Deutsch](providers.de.md) | [Português](providers.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

이 가이드는 [개발 가이드](../../development.md)에 따라 웹 UI를 시작한 상태를 전제로 합니다. 모델 변경은 서버를 다시 시작할 필요 없이 다음 요청부터 적용됩니다.

<a id="configure-deepseek"></a>

## DeepSeek 설정하기

**설정 → 모델**을 엽니다. DeepSeek 카드에는 API 키 입력란이 하나 있습니다. 키를 입력하고 저장하세요.

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

키는 쓰기 전용입니다. 저장 후 페이지에는 민감한 값을 가린 설명만 전달되며, 비밀값 자체는 반환되지 않습니다. 키는 `$OCEAN_HOME/.credentials.yaml`에 저장되고 설정에는 해당 자격 증명에 대한 참조만 남습니다.

키가 저장되어 있고 기본 엔드포인트를 쓰면 DeepSeek API에서 게시하는 모델 목록을 사용합니다. 모델이 처음 필요할 때 목록을 불러오고, 사용 중에는 약 10분마다 백그라운드에서 갱신합니다. 불러오지 못하면 내장 목록을 사용합니다. **사용자 지정 설정** 아래 **모델**을 편집하면 자체 목록을 사용합니다. **기본값 복원**을 선택하면 게시 목록을 다시 사용하고 목록을 새로 가져옵니다. 게시 목록을 쓰는 동안에도 카드에는 내장 모델이 표시되므로 새로 게시된 모델은 모델 선택 메뉴에만 나타납니다. 목록, 대체 동작, 사용 조건은 [API 키 제공업체 참조 문서](../../../packages/llm/llm-deepseek-api-key/README.md)를 참고하세요.

<a id="add-a-third-party-provider"></a>

## 타사 제공업체 추가하기

**모델 제공업체 추가**를 선택합니다. 카드에서 **타사 모델 제공업체**가 열립니다. 함께 제공되는 목록에서 `anthropic`, `openai`, Kimi의 `moonshotai`, GLM의 `zai` 같은 제공업체를 선택하고 API 키를 입력한 뒤 저장하세요. 엔드포인트, 프로토콜, 모델 목록은 설치된 카탈로그에서 가져옵니다.

인증 항목의 **?**에는 저장된 자격 증명의 우선순위와 환경 변수로 인증하는 방법이 나옵니다. 저장된 자격 증명이나 목록에 표시된 환경 변수를 사용하려면 키 입력란을 비워 두세요. 초록색 안내는 환경 변수가 감지되었음을, 노란색 안내는 감지되지 않았음을 나타냅니다. 감지되지 않았다면 API 키를 입력하거나 표시된 환경 변수를 설정하세요. 미확인 안내는 상태를 읽지 못했다는 뜻입니다. 감지는 자격 증명을 검증하거나 연결을 테스트하지 않습니다. AWS 프로필과 Google 애플리케이션 기본 자격 증명 등 제공업체가 관리하는 자격 증명 파일은 감지 범위에 포함되지 않습니다. `openai-codex`처럼 자체 키 인증을 제공하지 않는 경우 프로필에서 자격 증명 참조를 명시해야 키 입력란이 표시됩니다.

저장된 키는 입력란에 일부를 가린 미리보기로 표시되며 초록색 안내는 저장된 키를 사용한다는 뜻입니다. 가운데 문자를 8개 이상 가릴 수 있을 때만 첫 하이픈 또는 밑줄 앞의 식별자와 키의 앞 5자, 뒤 4자가 표시됩니다. 그렇지 않으면 식별자와 키 전체가 점으로 표시됩니다. 문자 수는 유니코드 코드 포인트를 기준으로 셉니다. 저장된 키에는 표시 버튼이 없고, 표시, 복사, 잘라내기, 일부 편집을 할 수 없습니다. 입력하거나 붙여넣으면 키 전체가 바뀝니다. Backspace 또는 Delete를 누른 뒤 **적용**하면 저장된 키를 삭제하고 환경 변수 인증을 사용합니다. 새로 입력한 키를 비울 때도 저장된 키가 삭제 대상으로 표시됩니다. 저장 전에 **취소**하면 저장된 키가 유지됩니다. 삭제가 거부되면 설정은 바뀌지 않습니다. 키를 지운 뒤 설정 저장이 실패하면 이미 삭제한 키를 복구할 수 없다는 경고가 표시됩니다. **적용**을 다시 선택해 설정을 저장하거나 **닫기**로 현재 상태를 유지하세요. 공유 자격 증명을 삭제하면 같은 참조를 쓰는 모든 기능에 영향을 줍니다. 환경 변수에도 자격 증명이 없으면 제공업체에 인증이 설정되지 않습니다. 환경 변수 인증을 사용하는 빈 입력란에는 **환경 변수로 인증하려면 비워 두세요**와 감지 안내 하나가 표시됩니다. 새 키를 입력한 상태에는 적용 안내가 표시됩니다. 삭제 대기 중에는 해당 경로에 환경 변수가 지정된 경우 적용 후 쓸 변수 이름이 표시됩니다. 그 밖에 입력란이 비어 있지 않으면 인증 상태를 표시하지 않습니다. 주소 구성용 변수는 **기본 URL** 아래에 표시되며 자격 증명으로 취급되지 않습니다.

편집 가능한 키를 입력한 상태에서는 눈 모양 버튼이 표시됩니다. **비밀 값 표시**로 입력한 내용을 확인하고 **비밀 값 숨기기**로 다시 가리세요. 입력을 바꿔도 다시 가려집니다. 비밀번호 입력란에서는 잘라낼 수 없으므로 초안을 선택한 뒤 Backspace로 지우거나, 표시한 뒤 잘라내세요. 저장된 자격 증명은 계속 쓰기 전용입니다.

<a id="add-a-custom-model-api"></a>

## 사용자 지정 모델 API 추가하기

릴레이, 사내 게이트웨이, 자체 호스팅 서버, 설치된 카탈로그에 없는 제공업체에는 카드를 **사용자 지정 모델 API**로 전환하세요. 소문자 제공업체 ID, 기본 URL, API 프로토콜, 자격 증명, 모델 하나 이상을 지정합니다. 게이트웨이가 지원하는 **API 프로토콜**을 선택하세요. 선택지는 OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, Gemini API 네 가지입니다. 활성 프로필의 `cordis.patch.yml`에는 각각 `openai-completions`, `openai-responses`, `anthropic-messages`, `google-generative-ai`로 저장됩니다. Gemini API의 기본 URL에는 `https://gateway.example/v1beta`처럼 API 버전을 포함하세요. 제공업체 하나는 프로토콜 하나를 사용하므로 두 프로토콜을 제공하는 게이트웨이는 제공업체를 두 개 설정해야 합니다.

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

요청, 저장된 세션, 기본 모델, 자격 증명 참조가 제공업체 ID를 사용하므로 ID는 변경할 수 없습니다. ID를 바꾸려면 새 제공업체를 추가하고 기존 제공업체를 삭제하세요. 표시 이름, 기본 URL, 프로토콜, 자격 증명, 모델은 편집할 수 있습니다.

<a id="discover-models"></a>

### 사용 가능한 모델 찾기

**모델 카탈로그**에서 **사용 가능한 모델 가져오기**를 선택하면 엔드포인트에 모델 목록을 요청합니다. 양식의 기본 URL, 프로토콜, 키를 사용하며 저장된 제공업체에는 저장된 키를 사용할 수 있습니다. 결과는 검색할 수 있는 목록으로 열리고 기존 모델은 선택된 상태입니다. 추가할 모델을 선택하고 제거할 모델은 선택을 해제한 뒤 **목록 업데이트**를 누르세요. 엔드포인트가 반환하지 않은 기존 모델은 남습니다. 제공업체를 저장하거나 생성해야 변경 내용이 저장됩니다.

모델 가져오기는 일반적인 게이트웨이의 목록 형식을 지원합니다. 실패하거나 목록이 비어 있으면 모델 ID를 직접 추가해 같은 방식으로 사용할 수 있습니다. 내장 제공업체는 기본 URL이 게이트웨이를 가리켜도 설치된 카탈로그의 목록을 사용합니다. 게이트웨이가 실제로 제공하는 모델을 보려면 사용자 지정 제공업체를 이용하세요.

<a id="select-a-model"></a>

## 모델 선택

설정한 제공업체는 모델 선택 메뉴에 나타납니다. 모델을 선택하면 새 세션의 기본값이 됩니다. 모델에 이미 요청을 보낸 세션은 자체 로그에 기록된 모델을 유지합니다.

모델 순서를 변경하려면 **설정 → 모델**에서 제공업체를 편집하고 **사용자 지정 설정**을 연 뒤 모델의 세 줄 손잡이를 드래그하세요. 손잡이에 초점을 두고 위아래 화살표 키를 눌러도 이동할 수 있습니다. **적용**하면 순서를 저장하고 **취소**하면 변경을 버립니다. 모델 선택 메뉴는 제공업체 안에서 저장된 순서를 따릅니다.

저장된 기본 모델의 제공업체를 삭제하면 입력란에 **모델 선택**이 표시됩니다. 다른 모델을 선택할 때까지 입력할 수 없습니다.

<a id="advanced-configuration"></a>

## 고급 구성

생성 된 [플러그인 구성 카탈로그](../../config-catalog.md) 목록 모든 지원 필드 및 기본 모든 플러그인; [`ocean-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) 는 공급자 섹션이 페이지 구성입니다. [`ocean-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) 및 [`ocean-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) 참조 자체 직접 `cordis.patch.yml` 구성, 카탈로그 해상도, 소싱 컨트롤, 자격 증명, 어댑터 오류.

::: tip 추가 설정

모델 페이지에서 API 키, 표시 이름, 기본 URL, API 프로토콜, 모델별 ID, 표시 이름, 컨텍스트 창, 최대 출력 토큰 수, 입력 유형을 설정할 수 있습니다. 사용자 지정 모델 API 제공업체는 모델의 추론 수준도 설정할 수 있습니다. 내장 제공업체 모델의 추론 수준, 요청 호환성 스위치, 헤더, 시간 제한, 재시도 정책은 페이지가 쓰는 것과 같은 `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`에 설정하세요. 파일을 직접 편집하거나, 브라우저와 서버가 같은 컴퓨터에서 실행될 때 설정 화면 상단의 **구성 파일 열기**를 사용하세요. 어댑터는 다음 요청 때 파일을 다시 읽으므로 재시작이 필요 없습니다. 아래에서 대부분의 게이트웨이에 필요한 필드를 다룹니다.

표준 Web UI를 `ocean web`으로 시작했다면 `<profile>`은 `web`이고 경로는 `$OCEAN_HOME/profiles/web/cordis.patch.yml`입니다. 사용자 지정 프로필로 실행했다면 시작할 때 선택한 프로필 이름을 사용하세요.

:::

<a id="image-input"></a>

### 이미지 입력

**설정 → 모델**에서 제공업체를 편집하고 **사용자 지정 설정**을 연 뒤 해당 모델의 **모델 옵션**을 펼치세요. 용량 필드 아래에 **입력 유형** 행이 있습니다. 이미지를 받는 모델에는 **이미지**를 선택하고 저장하세요. 이미지 지원을 상속하지 않은 새 사용자 지정 모델에는 **텍스트**가 기본 선택됩니다. 입력 유형을 하나 이상 선택해야 하므로 이미지 전용 모델은 이미지를 먼저 선택한 뒤 텍스트 선택을 해제하세요.

체크박스는 pi-ai 모델의 `input`과 직접 연결하는 DeepSeek 어댑터의 `inputModalities`를 저장합니다. `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`에서도 모델을 편집할 수 있습니다. 다음 사용자 지정 pi-ai 제공업체는 텍스트 전용 모델과 이미지 지원 모델을 하나씩 선언합니다.

이 예제는 프로필 패치의 구성 필드를 보여 줍니다. Cordis에서 구성을 덮어쓰면 항목 전체가 바뀝니다. 기존 설정을 편집할 때는 다른 제공업체와 필드를 유지하세요.

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

pi-ai의 `input`은 `text`와 `image`를 받으며 해당 모델에만 적용됩니다. 명시한 목록에 항목이 있으면 그 값을 우선 적용합니다. `input`을 생략하거나 비워 두면 설치된 카탈로그의 입력 유형을 상속하고, 카탈로그에도 없으면 경로의 `defaultInput`을 사용합니다. 기본값은 `[text]`입니다. 항목을 열기만 하면 체크박스에는 상속된 값이 표시되고 별도의 설정은 저장되지 않습니다.

DeepSeek는 `inputModalities`를 생략하면 텍스트 전용으로 처리하며 빈 목록은 거부합니다. 텍스트 전용 모델은 이미지 제한을 지정할 수 없으므로 이미지 선택을 해제하면 `imagePixelBudget`과 `imageMaxBytes`도 제거됩니다. 나중에 이미지를 다시 활성화할 때 사용자 지정 제한이 필요하면 다시 설정하세요.

체크박스를 편집한 뒤 상속으로 돌아가려면 `cordis.patch.yml`에서 모델의 `input` 또는 `inputModalities`를 제거하세요. **기본값 복원**은 다른 모델의 변경 사항을 포함해 카탈로그에 적용한 설정 전체를 지웁니다. 카탈로그 전체를 복원할 경우에 사용하세요.

직접 입력한 모델이 모두 이미지를 받는다면 개별 모델 대신 경로에 대체 설정을 한 번 지정하세요.

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

`defaultInput`은 다른 설정이 없을 때 적용되며 기본값은 `[text]`입니다. 내장 제공업체에서는 카탈로그에 없는 모델에만 적용되므로 카탈로그에서 이미지 입력을 지원하는 모델에는 영향을 주지 않습니다. 그런 모델의 입력 유형을 제한하려면 자체 `input`을 지정하세요. 내장 제공업체에 명시적인 `models` 목록이 없다면 모델 ID를 키로 사용해 `modelOverrides`에 적으세요.

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

pi-ai 설정의 모든 입력 유형 목록에는 유형이 하나 이상 있어야 합니다. 모델 자체의 `input`은 예외로, 빈 목록이 생략과 같은 뜻입니다. 알 수 없는 입력 유형은 어디에 지정하든 거부됩니다.

두 필드는 엔드포인트가 지원하는 입력 유형을 선언하며 실제 지원 여부는 검증하지 않습니다. 이미지를 지원하지 않는 엔드포인트에서 모델에 이미지 입력을 선언하면 제공업체가 요청을 거부합니다.

<a id="deepseek-account-models"></a>

### DeepSeek 계정 모델

로그인한 DeepSeek 계정은 계정 서비스에서 모델 목록을 가져오므로 모델 페이지에 모델 편집기가 표시되지 않습니다. 개별 모델을 조정하려면 `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`에서 `modelOverrides`를 사용하세요. 필드는 DeepSeek의 `models` 항목과 같으며 설정하지 않은 필드는 목록의 값을 유지합니다.

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

더 최신 Ocean이 필요한 모델은 `CLIENT_UPGRADE_REQUIRED` 오류와 함께 설치해야 할 버전을 알려 줍니다. 목록, 대체 동작, 사용 조건은 [계정 제공업체 참조 문서](../../../packages/llm/llm-deepseek-account/README.md)를 참고하세요.

<a id="reasoning-effort"></a>

### 추론 수준

추론 수준을 선언한 모델에는 모델 선택 메뉴에 **추론 수준** 항목이 표시됩니다. 내장 제공업체 모델은 설치된 카탈로그의 수준을 상속하고, DeepSeek 모델은 어댑터의 수준을 사용합니다. 직접 추가한 모델은 수준을 선언하기 전에는 이 메뉴가 표시되지 않으며, 추론할지는 엔드포인트의 기본 설정에 따릅니다.

사용자 지정 모델 API 제공업체에서는 **설정 → 모델**에서 제공업체를 편집하고 **사용자 지정 설정**의 **모델 옵션**을 펼쳐 **추론 수준**을 켜세요. 처음에는 off, low, medium, high 행이 표시됩니다. **API 값**은 각 수준에서 실제로 전송하는 값이고 기본값은 수준 이름입니다. 제공업체의 API 문서에서 다른 표기를 요구할 때만 바꾸세요. 엔드포인트가 지원하는 수준에 맞춰 행을 추가하거나 지우고, off 이외의 수준을 하나 이상 남긴 뒤 저장합니다. 스위치를 끄면 선언이 제거됩니다.

모델 페이지는 `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`에 `reasoningEfforts`를 저장합니다. 이 파일에서 추론 수준을 직접 선언할 수도 있습니다.

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

키는 메뉴에 표시할 수준이고, 값은 `reasoning_effort`로 전송할 표기입니다. `max: xhigh`처럼 게이트웨이에서 사용하는 이름을 지정할 수 있습니다. 값을 비워 둘 수 있는 수준은 `off`뿐입니다. 대부분의 엔드포인트는 매개변수를 생략하면 추론을 하지 않습니다. 경로의 `reasoning`은 세션이 수준을 선택하지 않았을 때 사용됩니다. 메뉴에서 수준을 선택하면 모델과 함께 새 세션의 기본값으로 저장됩니다.

`off`를 비워 두면 추론 필드를 보내지 않으므로 요청이 있을 때만 추론하는 모델에 적용됩니다. `off`에 값을 지정하면 그 값을 `reasoning_effort`로 보냅니다. OpenAI 호환 게이트웨이 뒤의 DeepSeek V4처럼 기본적으로 추론하는 모델에는 `compat.thinkingFormat: deepseek`가 필요합니다. 그러면 `off`는 `thinking: {type: disabled}`를 보내고 다른 수준은 추론 수준과 함께 `thinking: {type: enabled}`를 보냅니다.

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

추론 기능이 없는 게이트웨이에서 내장 제공업체 모델을 쓴다면 `modelOverrides`에서 `reasoningEfforts: false`를 설정하세요. 이 모델에서 추론 수준을 선택하면 `UNSUPPORTED_REASONING_EFFORT` 오류가 발생합니다. DeepSeek의 직접 연결 경로는 이미 `off`, `low`, `high`, `max`를 제공하며, 모델 선택 메뉴의 초기값은 `llm-deepseek.reasoningEffort`로 설정합니다.

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### 요청 호환성

키가 유효하고 주소에 연결할 수 있어도 게이트웨이가 모든 요청을 거부할 수 있습니다. pi-ai는 엔드포인트의 URL을 바탕으로 시스템 프롬프트의 역할, 출력 제한 필드, 추론 수준의 전달 방식을 정합니다. 알 수 없는 주소에는 OpenAI와 같은 형식으로 요청합니다. 대부분의 OpenAI 호환 게이트웨이는 그 형식 일부를 지원하지 않습니다.

주된 차이는 두 가지입니다. 추론을 선언한 모델에는 시스템 프롬프트를 `role: "developer"`로 보내는데, 많은 게이트웨이는 이 역할을 거부합니다. 출력 한도는 `max_completion_tokens`로 보내므로 `max_tokens`만 지원하는 서버에서 거부됩니다. 양식에는 두 항목이 없으므로 `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`에서 경로 설정을 수정하세요.

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

경로의 `compat`은 각 모델의 기본값입니다. 모델 설정은 필드별로 우선하므로 경로 전체를 다시 적지 않고 모델 하나만 조정할 수 있습니다.

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

경로와 모델 양쪽에서 설정하지 않은 항목은 설치된 카탈로그의 값을 따릅니다. 카탈로그에 없으면 pi-ai가 자동으로 결정합니다. 스위치를 적을 때는 반드시 값을 지정하세요. `supportsDeveloperRole:`처럼 비워 두면 대체 값 없이 카탈로그 설정을 없애므로 거부됩니다. 어떤 프로토콜도 지원하지 않는 이름 역시 거부되며 오류 메시지에 쓸 수 있는 이름이 표시됩니다.

스위치는 이를 지원하는 프로토콜에만 적용됩니다. 한 `api`에서 유효한 스위치가 다른 프로토콜에서는 거부될 수 있으며 메시지에 해당 프로토콜의 선택지가 나옵니다. 위의 `input`처럼 스위치는 엔드포인트의 지원 여부를 선언하며 실제로 검증하지 않습니다. 게이트웨이에 필요 없는 스위치를 설정하면 요청 내용이 달라집니다.

스위치별 허용 값과 지원 프로토콜은 소스에서 생성되는 [`ocean-llm-pi-ai` 구성 참조](../../config-catalog.md#oceanocean-llm-pi-ai)의 `PiAiCompatProfile`에 나와 있습니다.

<a id="troubleshooting"></a>

## 문제 해결

- **`MISSING_CREDENTIAL`**. 모델 페이지에서 제공업체의 키를 저장하거나 참조된 환경 변수를 설정하세요.
- **`UNKNOWN_MODEL`**. 설정된 모델을 선택하거나 사용자 지정 제공업체에 해당 모델을 추가하세요.
- **사용 가능한 모델을 가져올 때 401이 반환됩니다.** 키를 확인하세요. 모델 가져오기는 OpenAI 호환 `GET /models`를 호출합니다. 이 엔드포인트를 제공하지 않으면 모델을 직접 입력하세요.
- **모델을 가져올 때 `data` 배열도 `models` 객체도 없다고 표시됩니다.** 목록 형식이 지원되지 않습니다. 모델을 직접 입력하세요.
- **키와 URL은 올바르지만 게이트웨이가 모든 요청을 거부합니다.** 게이트웨이의 요청 형식이 OpenAI와 다릅니다. 먼저 경로에 `compat.supportsDeveloperRole: false`와 `compat.maxTokensField: max_tokens`를 지정하세요.
- **추론 모델만 실패합니다.** pi-ai는 시스템 프롬프트를 `developer` 역할로 보내는데 게이트웨이는 이를 거부합니다. `compat.supportsDeveloperRole: false`를 설정하세요.
- **직접 추가한 모델에 추론 수준 메뉴가 없습니다.** 추론 수준이 선언되어 있지 않습니다. 사용자 지정 모델 API 제공업체는 해당 모델의 **모델 옵션**에서 **추론 수준**을 켜세요. 그 외에는 `cordis.patch.yml`의 모델에 `reasoningEfforts`를 추가하세요.
- **`off`를 선택해도 DeepSeek가 추론을 계속합니다.** 빈 `off`는 추론 필드를 보내지 않으므로 기본적으로 추론하는 엔드포인트는 계속 추론합니다. 모델이나 경로에 `compat.thinkingFormat: deepseek`를 설정하세요.
- **호환성 스위치에 값이 없다는 오류가 표시됩니다.** 콜론 뒤에 값이 없습니다. 값을 지정하거나 키를 제거해 설치된 카탈로그의 값을 사용하세요.
- **이미지가 전송 전에 거부됩니다.** 모델이 이미지 입력을 선언하지 않았습니다. 사용자 지정 제공업체의 모델에 `input: [text, image]`를 설정하세요. DeepSeek 직접 연결 경로는 카탈로그에서 이미지 지원 항목(기본값은 `deepseek-flash`)을 선택하고, 게이트웨이가 그 모델의 이미지 입력을 지원하는지 확인하세요.
- **제공업체가 이미지를 포함한 요청을 거부합니다.** 모델에 이미지 입력을 선언했지만 엔드포인트는 이를 지원하지 않습니다. 모델의 `input`이나 경로의 `defaultInput` 중 이미지 입력을 허용한 목록에서 `image`를 제거하고 새 세션을 시작하세요. 첨부 이미지는 세션 로그에 남아 있으므로 세션을 옮기기 전까지 같은 요청이 반복됩니다.
