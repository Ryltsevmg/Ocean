<a id="connect-a-third-party-memory-mcp-server"></a>

# Conectar um servidor MCP de memória de terceiros

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | [日本語](mcp-memory.ja.md) | [Español](mcp-memory.es.md) | [Français](mcp-memory.fr.md) | [Deutsch](mcp-memory.de.md) | Português | [한국어](mcp-memory.ko.md)
<!-- USER_LANGUAGES_END -->

Estas três **configurações de referência desativadas por padrão** conectam um sistema de memória ao DSH por meio de [`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md). Escolha uma ou copie a mesma entrada MCP genérica para outro servidor.

Essas configurações de terceiros são fornecidas apenas como exemplos de interoperabilidade. Sua inclusão não implica endosso, recomendação, parceria ou suporte contínuo pelo projeto Ocean.

<a id="what-dsh-does"></a>

## O que o DSH faz

O DSH processa o arquivo de configuração adicional do Cordis selecionado, inicia um comando stdio configurado ou se conecta a uma URL Streamable HTTP configurada, descobre ferramentas MCP e as expõe como `mcp__<serverName>__<tool>`. O DSH **não** baixa o servidor, inicializa seu banco de dados, escolhe seu provedor de modelos ou embeddings, cria uma conta na nuvem, migra dados do fornecedor ou supervisiona um serviço HTTP separado. Para stdio, o cliente genérico inicia e encerra o processo filho conforme o ciclo de vida do plugin DSH; para HTTP, o serviço externo já deve estar em execução.

A ponte stdio remove deliberadamente as variáveis do ambiente cujos nomes costumam identificar credenciais e todas as variáveis `DSH_*` antes de iniciar um processo filho; as demais variáveis continuam sendo herdadas. Cada exemplo adiciona apenas a configuração mínima necessária. Se um recurso opcional do servidor precisar de outro segredo, adicione a variável ao `config.env` da entrada em vez de colocar o segredo diretamente no YAML.

<a id="choose-one"></a>

## Escolher um sistema

| Sistema | Versão fixada e testada | Transporte | Pré-requisito do fornecedor |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ e `npm install --global memorix@1.3.0` |
| [MCP Reference Memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ e `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`, ou o binário da versão correspondente |

<a id="enable-one"></a>

## Ativar um sistema

Passe o arquivo de configuração ao DSH.

```sh
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Substitua o nome do arquivo por `mcp-reference-memory.cordis.yml` ou `engram.cordis.yml`. O caminho pode apontar para uma cópia do arquivo em qualquer local do disco. A composição distribuída não inclui nenhum servidor de memória; portanto, omitir `--patch` mantém os três desativados.

Para manter a seleção entre execuções, mescle o único patch `insert` do arquivo escolhido em uma camada de patches do usuário: `$DSH_HOME/profiles/<name>/cordis.patch.yml` para um perfil, ou `$DSH_HOME/cordis.patch.yml` para todos os perfis da máquina. Não sobrescreva um arquivo existente: ele já pode conter outros patches do usuário.

<a id="provider-setup"></a>

## Configuração dos provedores

### Memorix

```sh
npm install --global memorix@1.3.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

O Memorix funciona no modo heurístico local sem um LLM ou serviço de embeddings. Configure provedores opcionais no próprio `~/.memorix/config.toml` do Memorix ou no `memorix.toml` do projeto. O exemplo mantém a identidade do projeto Git obtida pelo Memorix a partir do diretório de trabalho do DSH e usa o padrão `~/.memorix/data` do Memorix. Defina `MEMORIX_DATA_DIR` antes de iniciar o DSH para alterá-lo.

### MCP Reference Memory

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

Este servidor de referência armazena um grafo de conhecimento local e expõe ferramentas de entidades, relações, observações, leitura, busca e abertura. Ele não precisa de modelo ou serviço de embeddings. O exemplo salva o JSONL em `$HOME/.dsh-mcp-reference-memory.jsonl` em vez do diretório do pacote npm instalado. Defina `MEMORY_FILE_PATH` antes de iniciar o DSH para alterar esse local.

A busca compara substrings sem diferenciar maiúsculas e minúsculas nos nomes, tipos e observações das entidades; não é recuperação semântica. O servidor não adiciona embeddings, resumos automáticos, resolução de conflitos ou política de esquecimento.

### Engram

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

O Engram gerencia o armazenamento e a seleção do projeto: usa `~/.engram` por padrão, detecta o projeto Git a partir do diretório de trabalho do DSH e aceita `ENGRAM_DATA_DIR` ou `ENGRAM_PROJECT` como variáveis do ambiente para substituir esses valores.

<a id="optional-shared-model-instruction"></a>

## Instrução compartilhada opcional para o modelo

Adicione esta instrução breve e independente de fornecedor às suas instruções existentes do modelo se as descrições das ferramentas do servidor não acionarem o uso da memória de forma confiável:

> Quando o usuário pedir para lembrar algo, chame uma ferramenta de escrita na memória. Quando informações anteriores puderem ser relevantes, pesquise na memória e use os resultados pertinentes.

Esta é apenas uma orientação adicional. Os exemplos não substituem a personalidade definida no prompt do sistema do DSH.

<a id="verify-write-fresh-session-recall-and-use"></a>

## Verificar escrita, recuperação em uma nova sessão e uso

Use um valor único e mantenha o mesmo escopo de armazenamento do provedor durante toda a verificação:

1. Na sessão A do DSH, peça: `Remember that my validation drink is lapsang-<unique suffix>.` Confirme que o modelo chamou a ferramenta de escrita do provedor e que ela retornou sucesso.
2. Crie a sessão B do DSH no mesmo Host em execução. Não copie a conversa da sessão A. Pergunte: `What is my validation drink? Check memory.` Confirme que o modelo chamou a ferramenta de busca ou recuperação do provedor e retornou o valor.
3. Ainda na sessão B, peça: `Use that preference to suggest one drink for the meeting.` Confirme que a resposta usa o valor recuperado.

Crie uma nova sessão no DSH. Você pode manter o mesmo Host em execução. Se um processo MCP filho falhar, a reconexão automática é acionada com espera progressiva e ressincronização das ferramentas; elas continuam listadas e as chamadas falham apenas durante a interrupção. Quando o limite de reconexões é atingido, as ferramentas são removidas do registro e as tentativas só voltam após recarregar ou reiniciar. A descoberta inicial é assíncrona: aguarde as ferramentas `mcp__...` do provedor antes de enviar o primeiro prompt de validação.

<a id="bring-another-mcp-server"></a>

## Usar outro servidor MCP

Copie os mesmos campos da entrada e use valores únicos para `id` e `serverName`:

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

Para um servidor remoto, use `transport: streamable-http`, `url` e `headers` no lugar deles. Instalação, identidade, autenticação, modelos, embeddings, persistência e licenciamento específicos do provedor continuam sendo responsabilidade dele.
