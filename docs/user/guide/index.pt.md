<a id="use-the-web-ui"></a>

# Usar a interface web

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | [日本語](index.ja.md) | [Español](index.es.md) | [Français](index.fr.md) | [Deutsch](index.de.md) | Português | [한국어](index.ko.md)
<!-- USER_LANGUAGES_END -->

Inicie a interface web seguindo o [guia de desenvolvimento](../../development.md); o comando exibe sua URL. Este guia começa quando o servidor já está em execução. O processo `dsh` usa o diretório de onde foi iniciado como local padrão do sistema de arquivos. Ao abrir a interface web pela primeira vez, adicione e selecione um espaço de trabalho.

<a id="configure-a-model"></a>

## Configurar um modelo

Abra **Configurações → Modelos** e escolha um provedor de modelos; o [guia de configuração de modelos](./providers.pt.md) lista os provedores disponíveis e explica como usar endpoints personalizados compatíveis com OpenAI. Para uma rota DeepSeek, insira sua [chave de API do DeepSeek](https://platform.deepseek.com/) e salve. A rota do modelo fica disponível imediatamente, sem reiniciar o servidor.

<a id="choose-a-workspace"></a>

## Escolher um espaço de trabalho

Clique em **Escolher espaço de trabalho**, adicione o diretório do projeto onde você iniciou `dsh` e selecione-o. O campo de composição de mensagens da sessão permanece indisponível até que um espaço de trabalho seja selecionado.

<a id="run-a-task"></a>

## Executar uma tarefa

Inicie uma sessão e envie:

> Resuma este repositório e identifique seus principais pacotes.

O agente pode ler e editar arquivos do espaço de trabalho, executar comandos, delegar tarefas e manter um plano. A interface web pede confirmação antes de operações que exigem aprovação pela política de permissões ativa.

<a id="continue"></a>

## Continuar

- [Configurar modelos](./providers.pt.md)
- [Configurar um proxy de rede](./network-proxy.pt.md)
- [Usar a memória MCP](./mcp-memory.pt.md)
- [Agendar lembretes](./schedule.pt.md)
- [Usar o SDK Python](./python-sdk.pt.md)
- [Publicar a interface web atrás de um proxy reverso](./public-deployments.pt.md)
- [Desinstalar o Ocean Desktop](./desktop-uninstall-cleanup.pt.md)
- [Usar outros modos da CLI](../../../apps/cli/README.md)
- [Desenvolver um plugin](../develop/basic/index.md)
