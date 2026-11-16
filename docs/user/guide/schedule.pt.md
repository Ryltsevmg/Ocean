<a id="schedule-reminders"></a>

# Agendar lembretes

<!-- USER_LANGUAGES_START -->
[English](schedule.md) | [中文](schedule.zh.md) | [Русский](schedule.ru.md) | [日本語](schedule.ja.md) | [Español](schedule.es.md) | [Français](schedule.fr.md) | [Deutsch](schedule.de.md) | Português | [한국어](schedule.ko.md)
<!-- USER_LANGUAGES_END -->

<a id="summary"></a>

## Resumo

Peça ao modelo em uma conversa para criar, listar, visualizar, editar, pausar, retomar ou excluir lembretes. Cada lembrete se repete por sua regra e entrega sua instrução para uma conversa existente, para uma nova conversa, ou para uma nova conversa em cada ocorrência. A página de tarefas Automation lista todos os lembretes do Host e pode criar, editar, executar, pausar, retomar e excluir um. Tarefas entregues de um tiro permanecem disponíveis até que você as exclua explicitamente.

<a id="table-of-contents"></a>

## Sumário

- [Criar lembretes](#create-reminders)
- [Inspecionar, executar e excluir tarefas](#manage-tasks)
- [Editar uma tarefa](#edit-timing)
- [Referência de calendário e entrega](#timing-and-delivery)
- [Exploração Adicional](#further-exploration)

<a id="create-reminders"></a>
## Criar lembretes

O perfil da Web enviado inclui o serviço Host Schedule e a página de tarefas Automation. Configure um provedor de modelo antes de pedir para criar lembretes.

As predefinições `standard`, `cordis`e `ptc` declaram as quatro ferramentas de lembrete e o contexto do relógio que dá ao modelo a hora atual e a zona do navegador, então essas predefinições fornecem `schedule_create`, `schedule_list`, `schedule_view`, e `schedule_edit`; a predefinição `minimal` não declara nenhuma das duas. Um subagente delegado vê as quatro ferramentas, mas cada ferramenta recusa uma chamada de um subagente delegado, então um subagente não pode ler ou alterar lembretes.

Peça ao modelo para criar, listar, visualizar, editar, pausar, retomar ou excluir lembretes. Ele usa `schedule_create` para criar um, `schedule_list` para listar os lembretes de cada conversação, `schedule_view` para ler um, e `schedule_edit` para mudar, pausar, retomar ou excluir um; uma edição mantém o ID do lembrete e registros de entrega salvos. Um lembrete de que o modelo cria tem um nome, uma instrução, uma hora de início em UTC ou em um fuso horário IANA, e uma regra de repetição RFC 5545, como todos os dias da semana às 09:00 ou apenas uma vez. Ele entrega para esta conversa, para uma nova conversa que sua primeira entrega cria, ou para uma nova conversa em cada entrega; uma nova conversa usa o diretório de trabalho e predefinido desta conversa. Cada entrega de um lembrete vem pelo menos um minuto após o horário agendado da entrega anterior, ou depois da execução anterior agora; um lembrete que abre uma nova conversa em cada entrega espera pelo intervalo mínimo de execução do Host, em vez disso, um minuto por padrão. Uma entrega tardia, por exemplo, após uma reinicialização do Host, não atrasa a próxima.

Uma conversa que uma entrega cria junta-se ao Workspace registrado em seu diretório de trabalho e toma o nome do lembrete como seu título. Para um lembrete que abre uma nova conversa em cada entrega, o título também indica o tempo de lançamento na zona da regra do lembrete, por exemplo `Weekday digest · 2026-10-12 09:00`.

Por exemplo, pergunte: “Lembre-se de mim todos os dias às 23:00 na Ásia/Shanghai para verificar o tempo.” Abaixo da resposta, um cartão mostra o nome e frequência do lembrete criado; Abra mostra seus detalhes na barra lateral direita. Verifique se a frequência se repete todos os dias às 23:00, não uma vez. Um lembrete único não se torna recorrente após a entrega. Depois que o lembrete é excluído, o cartão mostra excluído e não o abre mais.

Para criar um lembrete sem o modelo, abra as tarefas de Automação na barra lateral, abra Escolha um método de criação ao lado do Novo e escolha Criar manualmente; quando não existe nenhuma tarefa, Nova tarefa de automação abre o mesmo editor. Este editor também abre tarefas existentes e pede um nome de tarefa Automation, uma instrução de tarefa Automation, Executar em, Linked workspace, e Tempo de execução. Começa com Uma vez a uma hora a partir de agora no fuso horário do navegador e com Criar uma conversa e reutilizá-la. Executar em ofertas Crie uma conversa e reutilize-a, que cria uma conversa na primeira execução e continua a usá-la, e Nova conversa para cada execução, que cria uma conversa separada em cada execução e mostra o intervalo mínimo de execução do Host. Espaço de trabalho ligado lista cada espaço de trabalho registrado com seu diretório e seleciona o espaço de trabalho cujo diretório a nova conversação usa; ele começa no espaço de trabalho padrão, ou no primeiro espaço de trabalho quando o espaço de trabalho padrão não está registrado. Quando não existe espaço de trabalho, o espaço de trabalho Linked mostra Ungrouped e o diretório do projeto Host é usado. A nova conversação usa a predefinição padrão. Criar cria a tarefa e seleciona-a na lista, e descartar fecha o editor sem criar uma. Se o Host recusar a tarefa, o editor mantém sua entrada e declara o problema, por exemplo, que a data e hora devem ser no futuro.

Novo, e Criar em uma conversa no mesmo menu, abrir uma nova conversa no atual ou mais recente Espaço de trabalho; pedir ao modelo lá para criar a tarefa.

<a id="manage-tasks"></a>

<a id="inspect-run-and-delete-tasks"></a>

## Inspecionar, executar e excluir tarefas

Peça ao modelo para listar lembretes para ver os lembretes de cada conversação, ativos primeiro, ou para mostrar, pausar, retomar ou excluir um lembrete pelo seu ID.

Abrir tarefas de Automação a partir da barra lateral para ver lembretes em Sessões sem ativar suas conversas. Procurar pelo nome da tarefa, a instrução, ou o ID da conversação da tarefa, e filtrar pelo status da tarefa: Todos, Activados, Pausados ou Terminados. As filas são ordenadas pela sua hora programada, o mais cedo primeiro. Cada linha mostra o nome da tarefa e uma linha sumária: o status de uma tarefa pausada ou terminada, a frequência e, para uma tarefa ativada, o tempo agendado seguinte com seu tempo local e relativo.

As tarefas de uma sessão são as tarefas que lhe entregam, incluindo a última execução de uma tarefa que cria uma nova conversa para cada execução, e as tarefas que o seu Agente criou ou editou. Uma linha de sessão ociosa e não arquivada cuja sessão tem pelo menos uma tarefa ativa mostra uma marca de relógio; uma linha arquivada mantém essa célula em branco, com o seu estado de vida apenas na carta hover. Um hover longo em uma linha de sessão com tarefas ativas lista até duas dessas tarefas com sua frequência e sua próxima execução como um tempo de zona-dispositivo com sua duração relativa. O cabeçalho da sessão aberta mostra um relógio de lembrete somente para ícones enquanto a sessão tem tarefas ativas: ele abre os detalhes da única tarefa na barra lateral direita, ou então uma lista das tarefas em que cada linha abre os detalhes da tarefa ou apaga a tarefa.

Selecione uma tarefa para abrir seus detalhes. As regras mostram o nome da tarefa, Next execute com o seu tempo local e relativo ou o status de uma tarefa pausada ou terminada, a instrução, Repetir e Executar, que mostra a conversa atual vinculada para uma tarefa que entrega para uma conversa existente. A parte inferior dos detalhes mostra sessão Vinculada, ou última conversa de execução para uma tarefa que cria uma nova conversa para cada execução. Seu botão abre essa conversa quando a sessão está disponível e não é arquivada, e está desabilitada de outra forma; antes da primeira execução criar a conversa, a entrada mostra a criação pendente. Para uma tarefa que entrega para uma conversação existente, Rules declara quando essa conversa é arquivada, indisponível ou ainda carregando. Os detalhes da tarefa e exclusão permanecem disponíveis mesmo quando uma conversa não pode ser aberta. Navegar por tarefas não é uma Sessões não- arquivas.

Escolha os Registros para carregar os mais novos 20 registros salvos. Cada registro mostra o tempo de ocorrência na zona da regra da tarefa (a zona do navegador quando a regra não nomeia nenhum), um botão que abre a conversa que recebeu a entrega quando essa conversa está disponível, e a instrução salva; Expandir mostra uma instrução longa na íntegra. Registros sem uma instrução salva nunca mostram a instrução atual em seu lugar. Carregar mais adiciona a página seguinte. Os registros seguem a ordem salva mais nova, mesmo que o relógio se mova para trás; eles não descrevem os resultados da execução do modelo. Setas esquerda/direita e Casa/Fim alternar as abas focadas.

Uma visão de registro vazia significa que uma consulta bem- sucedida retornou sem registros salvos. Carregar, solicitar falha, uma tarefa em falta, e um cursor de registro antigo inválido têm mensagens separadas. Usar Repetir após uma requisição falhada ou a resposta de tarefas em falta; usar Atualizar após um cursor inválido para recarregar a página mais recente. Registros carregados anteriormente podem permanecer visíveis com um aviso enquanto um pedido falha. Uma nova última entrega atualiza a página mais recente. Respostas tardias para uma tarefa ou visão que você deixou não substituem a visão atual.

Quando a retenção removeu registros anteriores, a última página afirma que os registros de entrega anteriores foram limpos, e as regras de retenção mostram quantos registros e quantos dias cada tarefa mantém. Uma tarefa antiga sem histórico salvo mostra apenas sua última entrega, sem instruções, até que novas entregas adicionem registros. Registros e instantâneos de instruções não salvos não podem ser recuperados.

As tarefas activas participam na programação. As tarefas pausadas e terminadas não agendam outra entrega. Uma tarefa única termina após seu lembrete ser escrito duravelmente na caixa de entrada da conversação, e uma tarefa repetida termina após a última ocorrência de sua regra; escolha Todos ou Terminados no status da tarefa para encontrar uma tarefa terminada. O relógio do cabeçalho da sessão, a marca da linha e a carta hover mostram apenas tarefas activas, pelo que o desaparecimento dessas vistas não significa que a tarefa tenha sido apagada.

Pausa nos detalhes para as futuras entregas de uma tarefa ativa, e retomar reinicia uma tarefa pausada. Corra agora, no menu de ações da tarefa de Automação, pede ao Host para entregar a instrução uma vez agora e mantém a próxima execução agendada, também para uma tarefa pausada ou terminada. Enquanto uma entrega de uma tarefa que entrega para uma conversação existente ou para uma nova conversação está em fila de espera ou em execução, os campos, Salvar alterações, Pausar, Continuar, Executar agora, e Excluir tarefa estão desativados, e os detalhes dizem que a tarefa está em fila de espera ou em execução e que você gerenciá-la em sua conversação, que o botão na parte inferior dos detalhes abre. Uma tarefa que cria uma nova conversa para cada execução não é desactivada desta forma; as suas execuções continuam umas ao lado das outras. Após uma entrega, Run agora permanece desativado até que o intervalo mínimo de entrega da tarefa termine; enquanto apenas o intervalo o mantém, mantenha o ponteiro no Run agora ou mova o teclado para ele para ver quando ele fica disponível. Se o Host recusar uma execução por uma dessas razões, os detalhes indicam que a tarefa está em fila de espera, em execução ou foi apenas entregue. Executar agora também está desabilitado enquanto a conversa que a tarefa entrega é arquivada. Se você parar a conversa enquanto a instrução da tarefa espera lá, a instrução permanece na fila até sua próxima mensagem, a tarefa é a próxima execução programada, ou Executar agora começa.

Escolha Excluir tarefa do menu de ações da tarefa Automation e confirme para parar a entrega futura e remover a tarefa da lista, inclusive para uma tarefa pausada ou terminada. A exclusão remove a tarefa junto com seus registros de entrega salvos, então o histórico salvo da tarefa se foi. Confirmando o relatório de exclusão, o resultado em um aviso amplo do aplicativo — excluído, que também fecha os detalhes, ou uma falha que deixa a tarefa no lugar para tentar novamente; ele não remove as conversas ou retrai uma mensagem já na fila. A linha permanece visível até que uma consulta bem sucedida confirme as tarefas restantes. Se uma consulta falhar, tente novamente recarregar o catálogo; o erro não é um resultado de sucesso vazio.

<a id="edit-timing"></a>

<a id="edit-a-task"></a>

## Editar uma tarefa

Peça ao modelo para alterar o nome, instrução, regra de repetição ou alvo de entrega de um lembrete, ou pausar ou retomar; a alteração mantém o ID do lembrete e os registros de entrega salvos.

Em tarefas de Automação, selecione uma tarefa para alterar seu nome de tarefa de Automação, instrução de tarefa de Automação, Executar em, Espaço de trabalho Linkado e Tempo de Execução, incluindo para uma tarefa pausada ou terminada. Edita permanecer em um rascunho local até que você escolha Salvar alterações. A edição mantém o ID da tarefa, o recibo de entrega mais recente e todos os registros de entrega salvos. Uma regra alterada torna uma tarefa terminada ativa novamente e mantém uma tarefa pausada pausada. Para uma tarefa que entrega para uma conversa existente, execute em mostra a conversação vinculada atual; escolher outra opção faz com que as execuções posteriores criem suas conversas e configurem o espaço de trabalho ligado ao seu valor inicial, como em Criar manualmente. Uma tarefa mantém a predefinição armazenada enquanto o seu Espaço de Trabalho permanece o mesmo; um Espaço de Trabalho alterado usa a predefinição padrão.

- Uma vez: A data abre um calendário de mês, o tempo abre Hora, Minuto e Segundas colunas, e o fuso horário interpreta- as. A tarefa é executada uma vez e depois termina.
- A cada minutos N e A cada horas N: O intervalo define o número de minutos ou horas, pelo menos 1. O intervalo conta a partir do minuto em que você salva a tarefa.
- Todos os dias: intervalo define o número de dias, e o tempo abre colunas de hora e minuto.
- Semanal e de segunda a sexta-feira: O intervalo define o número de semanas, o Weekday seleciona os dias, e o Tempo abre as colunas Hora, Minuto e Segunda. Segunda a sexta-feira seleciona aqueles cinco dias ao mesmo tempo.
- Mensal: O intervalo define o número de meses, o dia do mês seleciona uma data de 1 a 31, e o tempo abre as colunas Hora, Minuto e Segunda. Um mês sem a data selecionada é executado no seu último dia.
- Personalizado: A regra personalizada contém o texto da regra. Uma regra que as outras opções não podem reproduzir abre em Personalizado. Uma tarefa existente sem texto de regra editável mostra a sua frequência original e mantém esse timing até que você salve uma substituição.

O fuso horário lista as zonas seleccionadas recentemente primeiro, marca a zona do sistema e procura por UTC offset, IANA ID ou cidade. Aparece para opções guiadas e expressões Personalizadas que usam uma zona separada; caso contrário, o texto de regra Personalizada fornece a sua zona.

Os campos mudam apenas um rascunho local. Se a tarefa atingir uma conversa existente, a sessão Atual vinculada permanece disponível para que você possa desfazer uma alteração de destino sem descartar outras edições. Enquanto você edita, a parte inferior dos detalhes mostra as alterações não salvas com o Descarte e Salve as alterações; Salvar as alterações envia apenas os campos alterados em uma atualização, e Descartar restaura os valores armazenados. Um salvamento envia uma nova regra apenas quando o tempo muda. Gravar as alterações permanece desactivada até que uma alteração significativa tenha campos e timing válidos. Texto personalizado inválido mantém o rascunho e mostra uma mensagem de correção; a Máquina também valida a regra ao salvar. Pausa, retomar, Executar agora, e exclusão esperar até que você salvar ou descartar alterações não salvas. Os campos estão desativados enquanto uma gravação está em voo. Deixar os detalhes não rebolo uma escrita Host já começou.

Alternar tarefas ou sair da página mantém rascunhos não salvos. Um catálogo atualiza um formulário puro; um formulário editado mantém todos os campos e sua versão original. Se a entrega ou outra edição alterar a tarefa, os detalhes indicam que a tarefa mudou em outro lugar e desabilitam as alterações Salvar quando a versão mais nova chega. O Host também verifica a versão em salvar. A revisão com minhas edições mantém o título, o prompt, o timing e os grupos de destino que você alterou e carrega os valores mais recentes para os outros grupos. Reveja todo o formulário antes de salvar; esta ação sozinho não salva. Se o mesmo grupo mudou em outro lugar, suas edições têm precedência no formulário. Descartar substitui todo o rascunho pelos últimos valores armazenados. Se outra gravação falhar, o rascunho permanece e os detalhes pedem que você tente novamente; verifique a tarefa antes de tentar novamente uma atualização cujo resultado é desconhecido. Uma atualização aceita atualiza o catálogo. Respostas tardias após fechar detalhes ou mudar tarefas não substituem a visão atual.

<a id="timing-and-delivery"></a>

<a id="timing-and-delivery-reference"></a>

## Referência de calendário e entrega

Os lembretes permanecem armazenados quando a sessão não está aberta. Enquanto o Host corre, ele restaura ou cria a sessão alvo quando um lembrete se torna devido e filas de acompanhamento sem interromper o trabalho atual. Reiniciando as verificações armazenadas e envia uma única tomada atrasada ou apenas a última ocorrência perdida de cada tarefa recorrente. O fechamento do Host para de agendar até que ele comece novamente. Due tarefas recorrentes para a mesma sessão pode compartilhar uma mensagem.

Uma regra de repetição em uma zona IANA segue o tempo local da parede: ele salta uma hora local que não existe e usa o instante anterior de uma hora local repetida. As tarefas existentes mantêm o seu tempo até que você salve uma nova regra: um lembrete fixo permanece alinhado com o seu tempo de criação, e um lembrete diário, semanal ou cron segue seus tempos locais salvos em sua zona IANA. O navegador fornece sua zona para interpretar pedidos de linguagem natural; nomear uma zona explicitamente evita ambiguidade. A página de tarefas Automation mostra cada próxima execução como um relógio de zona do navegador, e o texto de frequência nomeia a zona de uma regra quando difere da zona do navegador; uma regra que nomeia nenhuma zona usa a zona do navegador.

Registros de entrega salvos confirmam que as mensagens persistiram na caixa de entrada da conversa, não que o modelo tenha completado o trabalho solicitado. Falha na persistência da caixa de entrada ou gravação de tarefas adicionar nenhum registro salvo. Uma falha de falha ou de escrita de tarefas após a persistência da caixa de entrada pode deixar uma mensagem entregue sem registro e repetir uma entrega; exatamente uma vez a entrega não é garantida. Fechando o Host descarta cada mensagem que ainda espera em uma caixa de entrada de conversa: seu registro salvo permanece, o modelo nunca recebe essa mensagem, e o Host não envia novamente. Este não é um histórico de execução ou um canal de notificação externo.

Os registros salvos são podados quando um reconhecimento é adicionado: o Host mantém os registros cujo tempo de reconhecimento cai dentro da janela `deliveryHistoryDays` configurada, medido de volta do recibo adicionado `deliveredAt`, e no máximo os registros `deliveryHistoryRecords` mais novos. O último recibo sempre sobrevive, e uma janela poda marca registros anteriores indisponíveis. O Host mantém o histórico retido na memória e reescreve a linha de tarefas completa para cada reconhecimento. Os limites de paginação retornaram a contagem de registros, não o histórico retido ou os bytes de instrução.

Nome, instrução, timing e edição de destino, pausa e retomada estão disponíveis para o modelo através do `schedule_edit` e para a página de tarefas de Automação para cada lembrete; nem é um fluxo de trabalho de relé cross-Session. Uma mudança adiciona um aviso à próxima solicitação de modelo de cada conversa envolvida cujo Agente é carregado, exceto a conversa que fez a mudança. Os lembretes gravados apenas em um registro de sessão antigo não são agendados automaticamente; recrie os que você ainda precisa. Registros de tarefas excluídos anteriormente não são reconstruídos.

<a id="further-exploration"></a>
## Exploração Adicional

- [Agendar os campos de tarefas de documentos](../../../packages/schedule/schedule/README.md) de referência, alvos de entrega, regras de recorrência, persistência e limites de entrega.
- [Página de tarefas de automação referência](../../../packages/client/ui-schedule/README.md) descreve a página global e catálogo de cabeçalho de conversação.

<a id="dev-note"></a>

## Nota Dev

Nenhuma.
