<a id="configure-models"></a>

# Configurar modelos

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | [日本語](providers.ja.md) | [Español](providers.es.md) | [Français](providers.fr.md) | [Deutsch](providers.de.md) | Português | [한국어](providers.ko.md)
<!-- USER_LANGUAGES_END -->

Este guia pressupõe que você iniciou a interface web conforme o [guia de desenvolvimento](../../development.md). As alterações no modelo entram em vigor na próxima solicitação, sem reiniciar o servidor.

<a id="configure-deepseek"></a>

## Configurar o DeepSeek

Abra **Configurações → Modelos**. O cartão do DeepSeek mostra um único campo para a chave de API. Digite a chave e salve.

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

As chaves são somente para gravação. Após salvar, a página recebe uma descrição com o valor oculto. O segredo nunca é enviado à página. A chave é armazenada em `$OCEAN_HOME/.credentials.yaml` e as configurações guardam somente a referência à credencial.

Com uma chave salva e o endpoint padrão, o DeepSeek usa a lista publicada pela API. A lista é carregada quando os modelos são usados pela primeira vez e atualizada em segundo plano aproximadamente a cada dez minutos enquanto estiverem em uso. Se a lista não carregar, os modelos integrados são usados. Editar **Modelos** em **Configurações personalizadas** substitui a lista publicada pela sua. **Restaurar padrões** volta a usar e carregar a lista publicada. Nesse modo, o cartão continua mostrando os modelos integrados e os novos modelos publicados aparecem apenas no seletor. A [referência do provedor com chave de API](../../../packages/llm/llm-deepseek-api-key/README.md) documenta as regras de listagem, alternativas e requisitos de acesso.

<a id="add-a-third-party-provider"></a>

## Adicionar um provedor de terceiros

Escolha **Adicionar provedor de modelos**. O cartão abre em **Provedor de modelos de terceiros**. Selecione um provedor incluído no OCEAN, como `anthropic`, `openai`, `moonshotai` para Kimi ou `zai` para GLM. Digite a chave de API e salve. O catálogo instalado fornece o endpoint, o protocolo e a lista de modelos.

O botão **?** explica a prioridade das credenciais salvas e as variáveis de ambiente usadas como alternativa. Deixe a chave em branco para usar uma credencial salva ou tentar as variáveis listadas. Um aviso verde indica que uma variável foi detectada. Um aviso amarelo indica que nenhuma foi detectada. Nesse caso, insira uma chave de API ou configure a variável indicada. Se a consulta de status falhar, o aviso indica que o status não foi confirmado. A detecção não valida a credencial nem testa a conexão. A verificação não inclui arquivos gerenciados pelo provedor, como perfis da AWS ou credenciais padrão de aplicativos do Google. Provedores sem autenticação nativa por chave, como `openai-codex`, só exibem um campo de chave se o perfil especificar uma referência de credencial.

Quando há uma credencial salva, o campo exibe uma prévia mascarada e um aviso verde indica que a chave salva será usada. A prévia mantém o identificador anterior ao primeiro hífen ou sublinhado, os cinco primeiros caracteres e os quatro últimos da chave, desde que pelo menos oito caracteres intermediários fiquem ocultos. Caso contrário, o identificador e a chave viram pontos. A contagem usa pontos de código Unicode. Chaves salvas não têm botão para revelá-las e não podem ser copiadas, recortadas ou editadas em parte. Digitar ou colar substitui a chave inteira. Pressione Backspace ou Delete e depois **Aplicar** para remover a chave salva e usar a autenticação do ambiente. Esvaziar a chave de substituição também deixa pendente a exclusão da chave salva. **Cancelar** preserva a chave antes de salvar. Se a exclusão for recusada, as configurações permanecem como estavam. Se a chave for excluída, mas o salvamento das configurações falhar, um aviso informa que a exclusão é irreversível. Use **Aplicar** para tentar salvar de novo ou **Fechar** para deixar o resultado parcial. Excluir uma credencial compartilhada afeta todos os recursos que usam sua referência. Sem uma credencial no ambiente, o provedor fica sem autenticação. Quando o campo está vazio, o formulário indica que o ambiente será usado e exibe o status de detecção. Ao digitar uma chave nova, aparece um lembrete para aplicá-la. Se houver uma exclusão pendente e a rota declarar uma variável, o formulário informa qual será usada após a aplicação. Os demais campos preenchidos não exibem status de autenticação. Variáveis de endereço aparecem em **URL base** e ficam fora da detecção de credenciais.

Se você digitou uma chave de substituição, use **Mostrar segredo** para conferi-la e **Ocultar segredo** para voltar a mascará-la. O campo volta a esconder a chave ao editá-la. Campos nativos de senha não permitem recortar texto oculto. Selecione o rascunho e pressione Backspace para apagá-lo ou revele o segredo antes de recortar. As credenciais salvas continuam disponíveis apenas para gravação.

<a id="add-a-custom-model-api"></a>

## Adicionar uma API de modelos personalizada

Mude o cartão para **API de modelos personalizada** para um retransmissor, um gateway da empresa, um servidor próprio ou qualquer provedor ausente do catálogo instalado. Informe um ID de provedor em minúsculas, a URL base, o protocolo da API, uma credencial e pelo menos um modelo. O **Protocolo de API** deve corresponder ao do gateway. As quatro opções são OpenAI Chat Completions, OpenAI Responses, Anthropic Messages e Gemini API. Elas são salvas no `cordis.patch.yml` do perfil ativo como `openai-completions`, `openai-responses`, `anthropic-messages` e `google-generative-ai`. A URL base da Gemini API inclui a versão da API, como `https://gateway.example/v1beta`. Cada provedor usa um único protocolo. Se o gateway oferecer dois protocolos, configure dois provedores.

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

O ID do provedor é permanente porque solicitações, sessões salvas, modelos padrão e referências de credenciais usam esse identificador. Para mudá-lo, adicione outro provedor e exclua o antigo. O nome de exibição, a URL base, o protocolo, a credencial e os modelos podem ser editados.

<a id="discover-models"></a>

### Buscar modelos

No **Catálogo de modelos**, selecione **Buscar modelos disponíveis** para consultar os modelos oferecidos pelo endpoint. A solicitação usa a URL base, o protocolo e a chave do formulário, ou a chave salva do provedor. A resposta abre um seletor com busca. Os modelos já presentes aparecem marcados. Marque os modelos que deseja adicionar, desmarque os que deseja remover e escolha **Atualizar lista**. Os modelos configurados que o endpoint não lista são preservados. As mudanças são gravadas ao salvar ou criar o provedor.

A busca aceita os formatos de listagem comuns dos gateways. Se o endpoint não devolver modelos ou se a consulta falhar, informe os IDs manualmente. Para provedores integrados, a busca sempre retorna o catálogo instalado, mesmo que a URL base aponte para um gateway. Use um provedor personalizado para consultar os modelos oferecidos pelo gateway.

<a id="select-a-model"></a>

## Selecionar um modelo

Os provedores configurados aparecem no selecionador de modelos. Selecionar um modelo também o torna o padrão para novas sessões. Uma sessão que já enviou uma solicitação mantém o modelo gravado em seu próprio registro.

Para reordenar os modelos de um provedor, edite-o em **Configurações → Modelos**, abra **Configurações personalizadas** e arraste o controle de três linhas do modelo. Você também pode focar o controle e pressionar a seta para cima ou para baixo. **Aplicar** salva a ordem, e **Cancelar** descarta a alteração. O seletor segue a ordem salva para cada provedor.

Se o modelo padrão salvo pertencer a um provedor excluído, o campo de mensagem exibe **Selecionar modelo** e impede a entrada de texto até que outro modelo seja escolhido.

<a id="advanced-configuration"></a>

## Configuração avançada

O catálogo de configuração de plugins [gerado](../../config-catalog.md) lista todos os campos suportados e padrão para cada plugin; [`ocean-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) é a seção provedora que esta página configura. As referências [`ocean-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) e [`ocean-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) possuem configurações diretas `cordis.patch.yml` , resolução de catálogos, controles de raciocínio, credenciais e erros de adaptador.

::: tip Configurações adicionais
A página Modelos mostra a chave de API, o nome de exibição, a URL base e o protocolo de API do provedor. Para cada modelo, mostra o ID, o nome de exibição, a janela de contexto, o limite de tokens de saída e os tipos de entrada. Para provedores com API de modelos personalizada, também permite configurar os níveis de raciocínio. Para configurar esses níveis em provedores integrados, as opções de compatibilidade das solicitações, os cabeçalhos, os tempos limite e a política de novas tentativas, edite `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`, o mesmo arquivo gravado pela página. Se o navegador estiver no mesmo computador que o servidor, você também pode abri-lo com **Abrir arquivo de configuração** no cabeçalho de Configurações. Os adaptadores leem o arquivo de novo na próxima solicitação, sem reiniciar. As seções abaixo descrevem as opções mais usadas pelos gateways.

Ao iniciar a interface web com `ocean web`, `<profile>` é `web` e o caminho é `$OCEAN_HOME/profiles/web/cordis.patch.yml`. Se iniciar um perfil personalizado, use o nome selecionado na inicialização.
:::

<a id="image-input"></a>

### Entrada de imagens

Em **Configurações → Modelos**, edite o provedor, abra **Configurações personalizadas** e expanda **Opções do modelo**. **Tipos de entrada** aparece abaixo dos campos de capacidade. Selecione **Imagem** para um modelo que aceita imagens e salve. **Texto** vem selecionado em um modelo personalizado novo que não herda o suporte a imagens. Pelo menos um tipo deve ficar selecionado. Para um modelo que só aceita imagens, selecione **Imagem** antes de desmarcar **Texto**.

As caixas de seleção salvam `input` para modelos pi-ai e `inputModalities` para o adaptador direto DeepSeek. Você também pode editar o modelo em `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`; por exemplo, este provedor personalizado de pi-ai declara um modelo somente de texto e um modelo de visão:

Os exemplos usam campos de configuração de um patch de perfil. O Cordis substitui toda a configuração da entrada ao aplicar uma sobrescrita. Preserve os demais provedores e campos ao editar uma sobrescrita existente.

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

O campo `input` do pi-ai aceita `text` e `image` e vale apenas para aquele modelo. Uma seleção explícita e não vazia tem prioridade. Se `input` estiver ausente ou vazio, os tipos vêm do catálogo instalado. Na falta deles, vale o `defaultInput` da rota, cujo padrão é `[text]`. As caixas mostram os valores herdados. Abrir a linha não grava um valor novo.

Sem `inputModalities`, o DeepSeek aceita somente texto. Uma lista vazia é recusada. Desmarcar **Imagem** também remove `imagePixelBudget` e `imageMaxBytes` do modelo, pois o DeepSeek rejeita limites de imagem para um modelo que só aceita texto. Se habilitar imagens novamente e precisar de limites personalizados, configure-os outra vez.

Para recuperar os valores herdados após alterar as caixas, remova o campo `input` ou `inputModalities` do modelo em `cordis.patch.yml`. **Restaurar padrões** remove toda a personalização do catálogo, incluindo outras alterações nos modelos. Use essa opção para restaurar o catálogo inteiro.

Se todos os modelos que você adicionou à mão aceitarem imagens, defina os tipos padrão uma única vez na rota.

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

`defaultInput` é um retrocesso, não um sobreposição, e defaults para `[text]`: em um provedor built-in ele responde apenas para modelos seu catálogo não descreve, assim ele nunca remove imagens de um modelo de catálogo que tem. Estreite um daqueles com `input`próprio do modelo. Quando um provedor embutido não tem lista `models` explícita, escreva-o em `modelOverrides`, chaveado pelo id do modelo:

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

Na configuração do pi-ai, cada lista deve declarar pelo menos uma modalidade, exceto o próprio `input` do modelo, que pode ficar vazio para herdar os valores. Uma modalidade desconhecida é sempre recusada.

Esses campos declaram quais entradas o endpoint aceita, sem verificá-las. Se você declarar que um modelo aceita imagens e o endpoint não as aceitar, o provedor recusará a solicitação.

<a id="deepseek-account-models"></a>

### Modelos da conta do DeepSeek

Quando você entra em uma conta do DeepSeek, os modelos vêm do serviço de contas e a página Modelos não oferece um editor para eles. Para ajustar um modelo, use `modelOverrides` em `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`. Os campos correspondem aos de uma entrada do DeepSeek em `models`. Os campos omitidos conservam os valores da listagem.

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

Se um modelo exigir uma versão mais recente do Ocean, ele retorna `CLIENT_UPGRADE_REQUIRED` com a versão a instalar. A [referência do provedor de contas](../../../packages/llm/llm-deepseek-account/README.md) documenta as regras de listagem, alternativas e requisitos de acesso.

<a id="reasoning-effort"></a>

### Esforço de raciocínio

O seletor de modelos oferece o menu **Esforço** quando o modelo declara níveis de raciocínio. Os modelos de provedores integrados herdam os níveis do catálogo instalado e os modelos do DeepSeek mantêm os do adaptador. Se adicionar um modelo manualmente, o menu **Esforço** só aparece depois que você declarar os níveis. Até lá, o padrão do endpoint determina se o modelo usa raciocínio.

Para declarar níveis em uma API de modelos personalizada, edite o provedor em **Configurações → Modelos**, abra **Configurações personalizadas**, expanda **Opções do modelo** e ative **Níveis de raciocínio**. Os níveis iniciais são desativado, baixo, médio e alto. Cada linha associa um nível ao **valor API** que será enviado, cujo padrão é o nome do nível. Altere o valor se a documentação da API do provedor especificar outro. Adicione ou exclua linhas de acordo com o que o endpoint aceita, mantenha pelo menos um nível além de desativado e salve. Desativar a opção remove a declaração.

A página escreve `reasoningEfforts` em `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`, onde você também pode declarar os níveis diretamente:

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

Cada chave identifica um nível no menu e seu valor é enviado como `reasoning_effort`. Por exemplo, `max: xhigh` adapta o valor a um gateway que espera outro nome. Apenas `off` pode ficar vazio, pois a maioria dos endpoints desativa o raciocínio quando o parâmetro está ausente. A rota usa seu valor `reasoning` se a sessão ainda não tiver escolhido um nível. Ao escolher um nível, ele é salvo com o modelo como padrão para novas sessões.

Se deixar `off` vazio, o parâmetro é omitido e só deixam de raciocinar os modelos que raciocinam sob solicitação. Um `off` com valor envia esse valor como `reasoning_effort`. Se o modelo raciocinar por padrão, como o DeepSeek V4 atrás de um gateway compatível com OpenAI, use `compat.thinkingFormat: deepseek`. Assim, `off` envia `thinking: {type: disabled}`, e os demais níveis enviam `thinking: {type: enabled}` junto com o nível de esforço.

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

Se o gateway de um modelo de provedor integrado não aceitar raciocínio, desative os níveis com `reasoningEfforts: false` em `modelOverrides`. A escolha de um nível para esse modelo retorna `UNSUPPORTED_REASONING_EFFORT`. Os modelos da rota do DeepSeek já oferecem `off`, `low`, `high` e `max`. `llm-deepseek.reasoningEffort` define o valor inicial do seletor.

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### Compatibilidade de solicitações

Um gateway com endereço acessível e chave válida pode recusar todas as solicitações. O pi-ai usa a URL do endpoint para determinar o papel da instrução de sistema, o campo que limita a saída e como enviar o nível de raciocínio. Se não reconhecer a URL, envia a solicitação como se fosse para a OpenAI. A maioria dos gateways compatíveis com OpenAI recusa alguma opção aceita pela OpenAI.

Há duas causas frequentes. Para um modelo que declara raciocínio, o pi-ai envia a instrução de sistema com `role: "developer"`, que muitos gateways recusam. Ele também envia o limite de saída em `max_completion_tokens`, que servidores que só conhecem `max_tokens` recusam. O formulário não oferece esses campos. Configure-os na rota em `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`.

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

A configuração `compat` da rota serve de padrão para seus modelos. Os valores do modelo têm prioridade campo a campo. Você pode ajustar um único modelo sem repetir a configuração da rota.

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

Se o modelo e a rota deixarem um campo sem valor, vale o valor do catálogo instalado. Se ele também não estiver no catálogo, o pi-ai o detecta. Toda opção declarada precisa ter um valor. Uma chave vazia como `supportsDeveloperRole:` é recusada porque apagaria o valor do catálogo sem substituí-lo. Se nenhum protocolo aceitar o nome, ele será recusado e a mensagem indicará as opções disponíveis.

Cada opção pertence aos protocolos que a definem. Se uma opção válida para um valor de `api` for recusada em outro, a mensagem indica o que o protocolo aceita. Assim como `input`, essas opções descrevem o que o endpoint aceita sem verificá-lo. Configurar uma opção desnecessária altera a solicitação enviada.

A [referência de configuração gerada de `ocean-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) lista em `PiAiCompatProfile` todas as opções, os valores aceitos e os protocolos compatíveis. A referência é gerada a partir do código do adaptador.

<a id="troubleshooting"></a>

## Solução de problemas

- **`MISSING_CREDENTIAL`**. Salve a chave do provedor em Modelos ou configure a variável de ambiente indicada.
- **`UNKNOWN_MODEL`**. Selecione um modelo configurado ou adicione o modelo ausente ao provedor personalizado.
- **Buscar modelos disponíveis retorna 401**. Confira a chave. A busca chama o endpoint `GET /models` compatível com OpenAI. Adicione os modelos manualmente se o endpoint não oferecer essa operação.
- **A busca não retorna nem uma lista `data` nem um objeto `models`**. O endpoint usa um formato de listagem incompatível. Adicione os modelos manualmente.
- **O gateway recusa todas as solicitações com chave e URL válidas**. O formato esperado difere do da OpenAI. Comece com `compat.supportsDeveloperRole: false` e `compat.maxTokensField: max_tokens` na rota.
- **Apenas os modelos com raciocínio falham**. O pi-ai usa o papel `developer` para a instrução de sistema, e o gateway o rejeita. Defina `compat.supportsDeveloperRole: false`.
- **O menu Esforço não aparece para um modelo adicionado manualmente**. O modelo não declara níveis. Em uma API de modelos personalizada, ative **Níveis de raciocínio** em **Opções do modelo**. Nos demais casos, adicione `reasoningEfforts` ao modelo em `cordis.patch.yml`.
- **`off` não desativa o raciocínio em um modelo DeepSeek**. Quando `off` está vazio, nenhum campo de raciocínio é enviado e o endpoint continua usando seu padrão. Defina `compat.thinkingFormat: deepseek` no modelo ou na rota.
- **Uma opção de compatibilidade sem valor é recusada**. Informe um valor após os dois-pontos ou remova a chave para preservar o valor do catálogo instalado.
- **Uma imagem é recusada antes do envio**. O modelo não declara a modalidade de imagem. Adicione `input: [text, image]` ao modelo de um provedor personalizado. Na rota do DeepSeek, escolha um modelo com suporte a imagens no catálogo configurado (`deepseek-flash` por padrão) e confira se o gateway aceita imagens para esse modelo.
- **O provedor recusa uma solicitação com imagem**. O endpoint não aceita as imagens declaradas pelo modelo. Remova `image` da lista que habilitou esse tipo, seja o `input` do modelo ou o `defaultInput` da rota, e inicie uma nova sessão. A imagem anexada permanece no registro da sessão e a solicitação se repete até que a sessão avance além da imagem.
