<a id="get-started-with-the-python-sdk"></a>

# Начните работу с Python SDK

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | Русский | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

В этом руководстве вы соберёте Python SDK из исходников, запустите поставляемый автономный минимальный профиль и настроите тот же профиль `ocean` из своей программы. У Ocean пока нет проверенного публичного дистрибутива SDK в npm или PyPI.

<a id="prerequisites"></a>

## Требования

- Python 3.10 или новее
- Гит
- Linux x64, Linux arm64, macOS 14 или новее на arm64 или Windows x64
- DeepSeek-совместимая конечная точка API и учетные данные
- Изолированное рабочее пространство и изолированный дом в океане

<a id="build-the-sdk-from-source"></a>

## Соберите SDK из исходников

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

В публичных реестрах пока нет проверенного SDK Ocean. Пакет `deepseek-harness-sdk` из PyPI относится к исходному проекту. Соберите исполняемый файл рантайма и оба wheel-пакета из этого репозитория, затем установите их в виртуальное окружение.

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

Выберите значение `--platform` и соответствующий исполняемый файл в `dist-exe/` для вашей машины: `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64` или `win-x64`. Собирайте каждую цель на её собственной архитектуре. Установка включает wheel-пакет с нативным рантаймом для выбранной платформы и команду `ocean`. Для обычного запуска SDK системный Node.js не нужен. Точные имена файлов, процедуру сборки и проверки релиза см. в [инструкции по разработке Python](../../../python/development.md).

<a id="run-the-checked-in-example"></a>

## Запустите пример из репозитория

Экспортируйте учетные данные и, при необходимости, совместимую конечную точку прокси-сервера:

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

Запустите одну задачу с явным рабочим пространством и домашними путями:

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

::: code-group

```sh [Linux/macOS]
python python/sdk/examples/minimal.py \
  --workspace /absolute/path/to/disposable-workspace \
  --ocean-home /absolute/path/to/example-ocean-home \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

```powershell [Windows PowerShell]
python python/sdk/examples/minimal.py `
  --workspace C:\work\disposable-workspace `
  --ocean-home C:\work\example-ocean-home `
  --session-id example-001 `
  "Inspect the repository and fix the failing tests."
```

:::

Скрипт выводит итоговый ответ помощника или результат команды, предоставленный выбранным профилем. В заданном каталоге хранятся созданный профиль `sdk-minimal`, установленные плагины и несжатые журналы сессий JSONL в `sessions/`. Пример и SDK не читают `~/.ocean` неявно.

<a id="use-the-sdk-in-your-program"></a>

## Используйте SDK в своей программе

```python
from pathlib import Path

from deepseek_harness import DeepSeekHarness

workspace = Path("/absolute/path/to/disposable-workspace").resolve()
ocean_home = Path("/absolute/path/to/example-ocean-home").resolve()
with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cwd=str(workspace),
    ocean_home=str(ocean_home),
    profile="sdk-minimal",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

SDK запускает поставляемый процесс `ocean --profile sdk-minimal` при первом обращении и повторно использует его до выхода из контекстного менеджера. Профиль, его постоянный патч, общий патч домашнего каталога и переданный по порядку кортеж `patches` образуют конфигурацию приложения. У Python нет отдельной команды рантайма или возможности передать полную конфигурацию в обход этого механизма.

<a id="install-or-define-plugins"></a>

## Установить или определить плагины

Используйте `ocean plugin` для зависимостей и слоев пучка, которые должны сохраняться в этом доме:

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

::: code-group

```sh [Linux/macOS]
export OCEAN_HOME=/absolute/path/to/example-ocean-home
ocean --profile sdk-minimal --dump-default-config >/dev/null
ocean plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

```powershell [Windows PowerShell]
$env:OCEAN_HOME = "C:\work\example-ocean-home"
ocean --profile sdk-minimal --dump-default-config | Out-Null
ocean plugin --profile sdk-minimal add file:C:/work/my-plugin-bundle
```

:::

Первая команда инициализирует поставляемый автономный профиль. Вторая передаёт управление пакетами в `pnpm` и регистрирует установленные пакеты, экспортирующие слой `ocean.bundle`. Установите `pnpm`, только если вам нужно управлять пакетами. Для запуска установленного SDK он не нужен. Для постоянных изменений записей редактируйте `$OCEAN_HOME/profiles/sdk-minimal/cordis.patch.yml`. Для изменений на один запуск передавайте файлы патчей из Python.

Можно указать другой `profile`, если он включает `@ocean/ocean-sdk-app` или другую запись сервера JSON-RPC. При отсутствии сервера, неразрешённом плагине или неверном патче запуск завершится ошибкой, без подстановки другой конфигурации.

<a id="opt-in-to-str_replace_editor"></a>
### Подключите `str_replace_editor`

Поставляемый рантайм включает `str_replace_editor`, но `sdk-minimal` не добавляет его в дерево Cordis по умолчанию. Чтобы подключить редактор, сохраните конфигурацию как `editor.patch.yml`. Операция `insert` добавляет редактор с существующим провайдером файловой системы:

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

Передайте `patches=("/absolute/path/to/editor.patch.yml",)` при создании `DeepSeekHarness(profile="sdk-minimal", ...)` или сохраните патч в `$OCEAN_HOME/profiles/sdk-minimal/cordis.patch.yml` для постоянной настройки. При следующем запуске в запросах к модели появится `str_replace_editor` вместе с инструментами по умолчанию. Локальный провайдер файловой системы разрешает относительные пути от рабочего каталога рантайма, но, как и оболочка минимального профиля, не ограничивает доступ этим каталогом. Этот же патч работает со стандартным профилем `sdk`.

<a id="enable-team-mode"></a>
### Включить режим Team

Для совместной работы агентов используйте стандартный профиль `sdk`. В `sdk-minimal` нет субагентов и служб совместной работы. Сохраните [патч для совместной работы](../../../apps/cli/config/examples/team-mode.yml) как `team-mode.yml`:

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

Передайте абсолютный путь к файлу в параметре SDK `patches` с `profile="sdk"`. Для Python используйте `patches=("/absolute/path/to/team-mode.yml",)`, для TypeScript — `patches: ["/absolute/path/to/team-mode.yml"]`. Патч полностью заменяет конфигурацию записи `agent-team`, поэтому пользовательский предел `maxTasks` указывайте в том же объекте.

Создайте новую корневую сессию и попросите её создать и перечислить общие задачи. Первый запрос к модели включает инструменты совместной работы и инструкции по их использованию. Режим сохраняется в корневой сессии и применяется к её субагентам. При возобновлении сессии сохраняется выбранный режим, в том числе если он был выключен или никогда не включался. Изменение или удаление патча не переопределяет этот выбор. Правила режима и задач описаны в [справке по службе совместной работы](../../../packages/team/agent-team/README.md#use-this-package).

<a id="understand-the-minimal-profile"></a>

## Что входит в минимальный профиль

| Собственность | ценность |
|---|---|
| Системная инструкция | `OCEAN_SYSTEM_PROMPT`, по умолчанию `You are a helpful software engineer assistant.` |
| Модель в `minimal.py` | `--model`, затем `OCEAN_MODEL`, затем `deepseek-v4-flash` |
| Инструменты для модели | Постоянная оболочка `bash` на Linux и macOS или `pwsh` на Windows, а также `read_image` и `working_directory` |
| Тайм-аут | 300 секунд |
| Необязательный контекст времени выполнения | отсутствует |
| Сжатие контекста | Автоматически суммирует старую историю отдельным запросом к модели |
| Сессионная устойчивость | Uncompressed JSONL `<ocean_home>/sessions` |

Единственный пакет профиля формирует полное дерево из пустого корня и не включает `ocean-base`, поэтому инструменты базового профиля не появятся неявно. Профиль содержит протокол SDK, один настроенный через окружение адаптер DeepSeek, локальное выполнение и хранение данных. Инструментов для текстовых файлов, настроек, управляемых учётных данных, OTel, веб-инструментов, субагентов и поиска локальных инструкций в нём нет. [Компонент журнала сессий DeepSeek](../../../packages/session/session-log-deepseek/README.md) по умолчанию отправляет ещё не принятые события журнала с запросами к DeepSeek, не более `maxBytes` (8 МиБ) на запрос. Для отключения задайте `session-log-deepseek.enabled: false` в патче профиля. Профиль использует `danger-full-access`: оболочка выбранной платформы может изменять любой путь, доступный рантайму. Для испытаний используйте временную копию репозитория или контейнер.

Для чтения изображений нужен маршрут с поддержкой изображений. Автоматическое сжатие контекста сохраняет полный журнал сессии. В [справке по пакету](../../../packages/bundle/sdk-minimal/README.md) описано, как это влияет на модель и хранилище. Неподдерживаемые команды с косой чертой в `sdk-minimal` остаются обычным текстом запроса.

Установленный wheel-пакет также содержит полный профиль `web` и ресурсы интерфейса. Если нужен браузерный клиент, запустите `ocean web` с явно указанным `OCEAN_HOME`. Профиль `web` запускает отдельное приложение CLI и не обслуживает клиентов Python SDK.

Для изоляции профилей, плагинов, учётных данных, настроек и сессий укажите новый домашний каталог. Для независимой работы используйте новый идентификатор сессии. Повторно используйте тот же экземпляр, каталог и идентификатор только для продолжения того же сохранённого чата и работы с его ресурсами.

Точный состав профиля описан в [справке по пакету](../../../packages/bundle/sdk-minimal/README.md), рабочая программа — в [описании примеров](../../../python/sdk/examples/README.md). В [справке по Python SDK](../../../python/sdk/README.md) описаны жизненный цикл, результаты, уведомления и низкоуровневое поведение. Правила наложения профилей приведены в [справке по ocean CLI](../../../apps/cli/reference/README.md).
