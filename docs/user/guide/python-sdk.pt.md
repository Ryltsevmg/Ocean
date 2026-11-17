<a id="get-started-with-the-python-sdk"></a>

# Primeiros passos com o SDK Python

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | Português | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

Este tutorial compila o SDK Python a partir do código-fonte deste repositório, executa o perfil mínimo independente incluído e mostra como personalizar o mesmo perfil `ocean` no seu programa. O Ocean ainda não tem uma distribuição pública validada do SDK no npm ou no PyPI.

<a id="prerequisites"></a>

## Pré-requisitos

- Python 3.10 ou mais recente
- Git
- Linux x64, Linux arm64, macOS 14 ou mais recente em arm64, ou Windows x64
- Um endpoint de API compatível com DeepSeek e sua credencial
- Um espaço de trabalho isolado e uma pasta do Ocean isolada

<a id="build-the-sdk-from-source"></a>

## Compilar o SDK a partir do código-fonte

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

Nenhum registro público hospeda um SDK Ocean validado; instalar `deepseek-harness-sdk` pelo PyPI baixa o pacote do projeto original, não o Ocean. Compile o executável do ambiente de execução e os dois pacotes wheel nesta cópia do repositório e instale-os em um ambiente virtual.

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

Escolha o valor de `--platform` e o executável correspondente de `dist-exe/` para sua máquina: `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64` ou `win-x64`; compile cada destino em sua arquitetura nativa. A instalação inclui um wheel do ambiente nativo correspondente e o comando `ocean`. A execução normal do SDK não precisa do Node.js do sistema. O [fluxo de contribuição em Python](../../../python/development.md) define os nomes exatos dos arquivos, a validação e as verificações de publicação dessas etapas de compilação.

<a id="run-the-checked-in-example"></a>

## Executar o exemplo incluído

Exporte a credencial e, quando necessário, um endpoint de proxy compatível:

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

Execute uma tarefa com caminhos explícitos para o espaço de trabalho e a pasta do Ocean:

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

O script exibe a resposta final do assistente ou o resultado do comando fornecido pelo perfil selecionado. A pasta do Ocean escolhida recebe o perfil gerado `sdk-minimal`, os plugins instalados e os registros de sessão JSONL não compactados em `sessions/`. O exemplo e o SDK nunca leem `~/.ocean` silenciosamente.

<a id="use-the-sdk-in-your-program"></a>

## Usar o SDK no seu programa

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

O SDK inicia o processo incluído `ocean --profile sdk-minimal` apenas quando necessário e o reutiliza até sair do gerenciador de contexto. O perfil, seu patch persistente, o patch da pasta do Ocean e qualquer tupla ordenada `patches` formam a configuração do aplicativo. Não há um executável separado para o ambiente de execução do Python nem uma opção de configuração completa.

<a id="install-or-define-plugins"></a>

## Instalar ou definir plugins

Use `ocean plugin` para dependências e camadas de pacotes que devem persistir nesta pasta do Ocean:

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

O primeiro comando inicializa o perfil independente incluído. O segundo encaminha o gerenciamento de pacotes ao `pnpm` e registra cada pacote instalado que exporta uma camada `ocean.bundle`. Instale `pnpm` apenas para esse comando de gerenciamento; iniciar o SDK instalado não exige isso. Edite `$OCEAN_HOME/profiles/sdk-minimal/cordis.patch.yml` para mudanças persistentes nas entradas ou passe arquivos de patches pelo Python para mudanças a cada inicialização.

Outro `profile` é válido quando inclui `@ocean/ocean-sdk-app` ou outra entrada de servidor JSON-RPC. Entradas de servidor ausentes, plugins não resolvidos e patches inválidos causam falha na inicialização em vez de recorrer a outra composição.

<a id="opt-in-to-str_replace_editor"></a>
### Ativar `str_replace_editor`

O ambiente incluído contém `str_replace_editor`, mas `sdk-minimal` o omite da árvore Cordis padrão. Para usá-lo, salve esta configuração como `editor.patch.yml`; `insert` adiciona o editor usando o provedor de sistema de arquivos existente:

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

Passe `patches=("/absolute/path/to/editor.patch.yml",)` ao construir `DeepSeekHarness(profile="sdk-minimal", ...)`, ou coloque o patch em `$OCEAN_HOME/profiles/sdk-minimal/cordis.patch.yml` para configuração persistente. Na próxima inicialização do ambiente, as solicitações ao modelo incluem `str_replace_editor` junto das ferramentas padrão. O provedor de sistema de arquivos local usa o diretório de trabalho do ambiente para caminhos relativos; assim como o shell mínimo, ele não restringe o acesso a esse diretório. O mesmo patch funciona com o perfil padrão `sdk`.

<a id="enable-team-mode"></a>
### Ativar o modo Team

Use o perfil padrão `sdk` para Agent Teams; `sdk-minimal` não inclui subagentes nem serviços Team. Salve o [patch Team](../../../apps/cli/config/examples/team-mode.yml) como `team-mode.yml`:

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

Passe seu caminho absoluto na opção `patches` do SDK com `profile="sdk"`. Python usa `patches=("/absolute/path/to/team-mode.yml",)`; TypeScript usa `patches: ["/absolute/path/to/team-mode.yml"]`. O patch substitui toda a configuração da entrada `agent-team`, portanto inclua qualquer limite personalizado de `maxTasks` no mesmo mapeamento.

Crie uma nova sessão raiz e peça para criar e listar uma tarefa compartilhada. Sua primeira solicitação ao modelo inclui as ferramentas Team e as orientações de colaboração. A raiz salva seu modo, e os subagentes o compartilham. Retomar uma sessão existente preserva seu modo, mesmo que tenha sido explicitamente desativado ou nunca ativado; alterar ou remover esse patch não substitui as seleções salvas. Consulte a [referência do serviço Team](../../../packages/team/agent-team/README.md#use-this-package) para a semântica do modo e das tarefas.

<a id="understand-the-minimal-profile"></a>

## Entender o perfil mínimo

| Propriedade | Valor |
|---|---|
| Prompt do sistema | `OCEAN_SYSTEM_PROMPT`, com `You are a helpful software engineer assistant.` como alternativa |
| Modelo em `minimal.py` | `--model`, depois `OCEAN_MODEL`, depois `deepseek-v4-flash` |
| Ferramentas visíveis ao modelo | `bash` persistente no Linux/macOS ou `pwsh` no Windows, `read_image` e `working_directory` |
| Tempo limite do shell | 300 segundos |
| Contexto de execução opcional | Ausente |
| Compactação de contexto | Automática; resume o histórico mais antigo por uma solicitação adicional ao modelo |
| Persistência de sessões | JSONL não compactado em `<ocean_home>/sessions` |

O único pacote do perfil insere a árvore completa sobre uma raiz vazia e não inclui `ocean-base`; portanto, ferramentas adicionadas depois ao perfil base não podem aparecer implicitamente. Ele contém o protocolo do SDK, um adaptador DeepSeek configurado pelo ambiente, execução local e persistência, mas não ferramentas de arquivos de texto, configurações, credenciais gerenciadas, telemetria OTel, ferramentas web, subagentes ou descoberta de instruções locais. O [componente de registros de sessão DeepSeek](../../../packages/session/session-log-deepseek/README.md) envia por padrão eventos do registro ainda não aceitos com as solicitações DeepSeek, até `maxBytes` (8 MiB) por solicitação; defina `session-log-deepseek.enabled: false` em um patch do perfil para desativá-lo. Ele fixa `danger-full-access`, então o shell persistente selecionado para a plataforma pode modificar qualquer caminho visível ao ambiente; use uma cópia descartável do repositório ou um contêiner.

A leitura de imagens exige uma rota compatível com imagens. A compactação automática preserva o registro completo da sessão. Consulte a [referência do pacote](../../../packages/bundle/sdk-minimal/README.md) para os efeitos no modelo e no armazenamento. Nesta composição `sdk-minimal`, os comandos com barra que o perfil não aceita continuam como texto comum do prompt.

O wheel instalado ainda inclui o perfil completo `web` e os recursos do frontend. Execute `ocean web` com um `OCEAN_HOME` explícito quando uma implantação do SDK Python também precisar do aplicativo de navegador; `web` é um aplicativo CLI separado e não pode atender a um cliente do SDK Python.

Use uma pasta do Ocean nova quando perfis, plugins, credenciais, configurações e sessões precisarem ficar isolados. Use um novo identificador de sessão para trabalho independente; reutilize um harness, sua pasta e o identificador apenas para continuar a mesma conversa persistente e os recursos dessa sessão.

A [referência do pacote](../../../packages/bundle/sdk-minimal/README.md) define a árvore exata, e a [referência do exemplo](../../../python/sdk/examples/README.md) define o programa executável. A [referência do SDK Python](../../../python/sdk/README.md) aborda ciclo de vida, resultados, notificações e comportamento de baixo nível; a [referência da CLI ocean](../../../apps/cli/reference/README.md) aborda as camadas dos perfis.
