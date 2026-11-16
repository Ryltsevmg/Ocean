<a id="get-started-with-the-python-sdk"></a>

# Начните работу с Python SDK

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | Русский | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

В этом руководстве построен Python SDK из источника этого хранилища, запущен автономный минимальный профиль и показано, как настроить тот же профиль `dsh` из вашей собственной программы. Ocean пока не имеет квалифицированного публичного распространения PyPI SDK.

<a id="prerequisites"></a>

## Предпосылки

- Python 3.10 или новее
- Гит
- Linux x64, Linux arm64, macOS 14 или новее на arm64 или Windows x64
- DeepSeek-совместимая конечная точка API и учетные данные
- Изолированное рабочее пространство и изолированный дом в океане

<a id="build-the-sdk-from-source"></a>

## Постройте SDK из источника

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

Ни один публичный реестр не содержит квалифицированный Ocean SDK; установка `deepseek-harness-sdk` от PyPI захватывает пакет проекта донора, а не Ocean. Постройте носитель времени выполнения и оба колеса в этом кассе, а затем установите их в виртуальную среду.

::: Код-группа

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

Выберите `--platform` ценность и соответствие `dist-exe/` Выполняемый для вашей машины: `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64`или `win-x64`; построить каждую цель на ее родной архитектуре. Установка включает в себя соответствующее нативное колесо времени выполнения и `dsh` Обычная реализация SDK не нуждается в системе Node.js. [Python-вкладчик рабочего процесса](../../../python/development.md) Владеет точными именами файлов, валидациями и проверками высвобождения для этих этапов сборки.

<a id="run-the-checked-in-example"></a>

## Запустите пример зарегистрированного

Экспортируйте учетные данные и, при необходимости, совместимую конечную точку прокси-сервера:

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

::: Код-группа

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

::: Код-группа

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

Сценарий печатает окончательный ответ помощника или результат команды, предоставленный выбранным профилем. Выбранный дом получает сгенерированный профиль `sdk-minimal` , установленные плагины и несжатые журналы сеансов JSONL под `sessions/`. Пример и SDK никогда молча не читают `~/.dsh`.

<a id="use-the-sdk-in-your-program"></a>

## Используйте SDK в своей программе

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

SDK запускает процесс `dsh --profile sdk-minimal` и повторно использует его до выхода контекст-менеджера. Профиль, его постоянный патч, домашний патч и любой упорядоченный `patches` кортеж образуют конфигурацию приложения. Отдельного бина времени выполнения Python или опции полной конфигурации не существует.

<a id="install-or-define-plugins"></a>

## Установить или определить плагины

Используйте `dsh plugin` для зависимостей и слоев пучка, которые должны сохраняться в этом доме:

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

::: Код-группа

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

Первая команда инициализирует отгруженный автономный профиль. Второй перенаправляет управление пакетами в `pnpm`, а затем записывает любой установленный пакет, который экспортирует слой `dsh.bundle` . Установите `pnpm` только для этой команды управления; запуск установленного SDK в этом не нуждается. Редактируйте `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` для постоянных изменений строк или передайте файлы патчей из Python для изменений на запуск.

Другой `profile` действителен, когда он включает `@ocean/ocean-sdk-app` или другую строку сервера JSON-RPC. Пропущенные строки сервера, неразрешенные плагины и недействительные патчи выходят из строя во время запуска, а не возвращаются к другой композиции.

<a id="opt-in-to-str_replace_editor"></a>
### Заходите. `str_replace_editor`

Связанная среда выполнения включает в себя `str_replace_editor`, но `sdk-minimal` опускает его из дерева Cordis по умолчанию. Для его использования сохраните эту конфигурацию, поскольку `editor.patch.yml`; `insert` добавляет редактор с помощью существующего поставщика файловой системы:

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

Перейдите `patches=("/absolute/path/to/editor.patch.yml",)` при создании `DeepSeekHarness(profile="sdk-minimal", ...)`или поместите патч в `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` для постоянной конфигурации. При следующем запуске модели запросы включают `str_replace_editor` рядом с инструментами по умолчанию. Поставщик локальной файловой системы использует рабочую директорию времени выполнения для относительных путей; как и минимальная оболочка, она не ограничивает доступ к этой директории. Тот же патч работает со стандартным профилем `sdk` .

<a id="enable-team-mode"></a>
### Включить режим Team

Используйте стандартный профиль `sdk` для команд агентов; `sdk-minimal` не включает субагенты или службы команд.Сохранить патч [Team](../../../apps/cli/config/examples/team-mode.yml) как `team-mode.yml`:

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

Пройдите свой абсолютный путь в опции `patches` SDK с `profile="sdk"`. Python использует `patches=("/absolute/path/to/team-mode.yml",)`; TypeScript использует `patches: ["/absolute/path/to/team-mode.yml"]`. Патч заменяет всю конфигурацию строки `agent-team` , поэтому включите любой пользовательский предел `maxTasks` в то же отображение.

Создайте новую корневую сессию и попросите ее создать и перечислить общую задачу. Первый запрос модели включает в себя инструменты Team и руководство по сотрудничеству. Корень сохраняет свой режим, и субагенты разделяют его. Возобновление существующего сеанса сохраняет свой режим, даже если он был явно выключен или никогда не включался; изменение или удаление этого патча не переопределяет сохраненные варианты. См. ссылку на службу [Team для семантики режимов и задач](../../../packages/team/agent-team/README.md#use-this-package) .

<a id="understand-the-minimal-profile"></a>

## Понять минимальный профиль

| Собственность | ценность |
|---|---|
| Система подсказки | `DSH_SYSTEM_PROMPT`, возвращаясь к `You are a helpful software engineer assistant.` |
| Модель в `minimal.py` | `--model`, затем `DSH_MODEL`, затем `deepseek-v4-flash` |
| Инструменты для моделирования | Persistent `bash` на Linux/macOS или `pwsh` на Windows, `read_image`и `working_directory` |
| Тайм-аут | 300 секунд |
| Необязательный контекст времени выполнения | отсутствует |
| Контекстное уплотнение | Automatic; обобщает старую историю с помощью дополнительного запроса модели |
| Сессионная устойчивость | Uncompressed JSONL `<dsh_home>/sessions` |

Единственная связка профиля вставляет полное дерево над пустым корнем и не включает `dsh-base`; поэтому более поздние инструменты базового профиля не могут появляться неявно. Он содержит протокол SDK, один адаптер DeepSeek с конфигурацией среды, локальное исполнение и настойчивость, в то время как инструменты текстовых файлов, настройки, управляемые учетные данные, телеметрия OTel, веб-инструменты, субагенты и обнаружение локальных команд отсутствуют. Участник сессионного журнала [DeepSeek](../../../packages/session/session-log-deepseek/README.md) по умолчанию загружает непринятые события журнала с запросами DeepSeek, максимум `maxBytes` (8 MiB) за запрос; установите `session-log-deepseek.enabled: false` в патче профиля, чтобы отключить его. Он зажимает `danger-full-access`, поэтому выбранная платформа может изменить любой путь, видимый во время выполнения; используйте одноразовый кассовый или контейнер.

Считывание изображений требует маршрута с возможностью отображения. Автоматическое уплотнение сохраняет полный журнал сеанса; см. [справочная справочная информация](../../../packages/bundle/sdk-minimal/README.md) Для моделей и эффектов хранения. `sdk-minimal` Композиция, неподдерживаемый слэш-ввод остается обычным оперативным текстом.

Установленное колесо по-прежнему упаковывает полный профиль `web` и фронтенд-активы. Запустите `dsh web` против явного `DSH_HOME` , когда развертывание Python SDK также требует приложения браузера; `web` является отдельным приложением CLI и не может обслуживать клиент Python SDK.

Используйте свежий дом, когда профили, плагины, учетные данные, настройки и сеансы должны быть изолированы. Используйте свежий идентификатор сеанса для независимой работы; повторно используйте упряжку, дом и идентификатор только для того, чтобы продолжать те же длительные разговоры и ресурсы, принадлежащие сеансу.

The [справочная справочная информация](../../../packages/bundle/sdk-minimal/README.md) Он владеет деревом, а [примерная ссылка](../../../python/sdk/examples/README.md) Владеет программой Runnable. [Ссылка на Python SDK](../../../python/sdk/README.md) охватывает жизненный цикл, результаты, уведомления и поведение низкого уровня; [CLI ссылка](../../../apps/cli/reference/README.md) Покрывает профильное наслоение.
