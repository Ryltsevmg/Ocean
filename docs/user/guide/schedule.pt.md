<a id="schedule-reminders"></a>

# Agendar lembretes

<!-- USER_LANGUAGES_START -->
[English](schedule.md) | [中文](schedule.zh.md) | [Русский](schedule.ru.md) | [日本語](schedule.ja.md) | [Español](schedule.es.md) | [Français](schedule.fr.md) | [Deutsch](schedule.de.md) | Português | [한국어](schedule.ko.md)
<!-- USER_LANGUAGES_END -->

<a id="summary"></a>

## Resumo

Peça ao modelo em uma conversa para criar, listar, consultar, editar, pausar, retomar ou excluir lembretes. Cada lembrete segue sua regra de repetição e entrega a instrução a uma conversa existente, a uma única conversa nova ou a uma nova conversa a cada execução. A página de tarefas de automação lista todos os lembretes do Host e permite criar, editar, executar, pausar, retomar e excluir tarefas. As tarefas de execução única continuam disponíveis após a entrega até que você as exclua.

<a id="table-of-contents"></a>

## Sumário

- [Criar lembretes](#create-reminders)
- [Inspecionar, executar e excluir tarefas](#manage-tasks)
- [Editar uma tarefa](#edit-timing)
- [Referência de horários e entregas](#timing-and-delivery)
- [Saiba mais](#further-exploration)

<a id="create-reminders"></a>
## Criar lembretes

O perfil Web distribuído inclui o serviço de agendamento do Host e a página de tarefas de automação. Configure um provedor de modelos antes de pedir que crie lembretes.

As predefinições `standard`, `cordis` e `ptc` declaram as quatro ferramentas de lembretes e o contexto de relógio que fornece ao modelo a hora atual e o fuso horário do navegador. Essas predefinições incluem `schedule_create`, `schedule_list`, `schedule_view` e `schedule_edit`. A predefinição `minimal` deixa ambos de fora. Os subagentes delegados veem as quatro ferramentas, mas elas recusam suas chamadas, impedindo que leiam ou alterem lembretes.

Peça ao modelo para criar, listar, consultar, editar, pausar, retomar ou excluir lembretes. Ele usa `schedule_create` para criar, `schedule_list` para listar os lembretes de todas as conversas, `schedule_view` para consultar e `schedule_edit` para alterar, pausar, retomar ou excluir. A edição preserva o ID e os registros de entrega salvos. O lembrete tem nome, instrução, horário inicial em UTC ou em um fuso IANA e uma regra RFC 5545, como todos os dias úteis às 09:00 ou uma única vez. O destino pode ser esta conversa, uma única conversa nova criada na primeira entrega ou uma nova a cada entrega. A nova conversa usa o diretório de trabalho e a predefinição desta conversa. Deve passar pelo menos um minuto desde o horário agendado da entrega anterior ou desde a última execução manual. Se cada entrega criar uma nova conversa, vale o intervalo mínimo de execução do Host, de um minuto por padrão. Uma entrega atrasada, por exemplo após reiniciar o Host, não adia a próxima.

A conversa criada em uma entrega entra no espaço de trabalho registrado para seu diretório e recebe o nome do lembrete como título. Se cada entrega criar uma conversa, o título também inclui o horário de início no fuso da regra, por exemplo `Weekday digest · 2026-10-12 09:00`.

Por exemplo, peça “Lembre-me todos os dias às 23:00 no fuso Asia/Shanghai de consultar a previsão do tempo”. Abaixo da resposta, um cartão mostra o nome e a frequência do lembrete. Clique em Abrir para ver os detalhes na barra lateral direita. Confira se ele se repete todos os dias às 23:00. Um lembrete de execução única não passa a se repetir após a entrega. Ao excluí-lo, o cartão indica Excluído e deixa de abri-lo.

Para criar um lembrete sem usar o modelo, abra as tarefas de automação na barra lateral, selecione Escolher método de criação ao lado de Novo e escolha Criar manualmente. Se não houver tarefas, Nova tarefa de automação abre o mesmo editor. O editor também abre tarefas existentes e solicita nome, instrução, destino, espaço de trabalho vinculado e horário. A configuração inicial é uma única execução daqui a uma hora no fuso do navegador e a reutilização de uma conversa nova. Você pode reutilizar a conversa criada na primeira execução ou criar uma nova a cada execução. A segunda opção mostra o intervalo mínimo de execução do Host. O seletor de espaços de trabalho lista os espaços registrados e seus diretórios. A conversa nova usa o diretório do espaço selecionado. O editor seleciona o espaço de trabalho padrão ou, se ele não estiver registrado, o primeiro. Se não houver espaços de trabalho, o editor indica que não há grupo e usa o diretório do projeto do Host. A nova conversa usa a predefinição padrão. Criar adiciona e seleciona a tarefa, enquanto Descartar fecha o editor sem criá-la. Se o Host recusar a tarefa, o editor preserva o que você preencheu e informa o problema, por exemplo, que a data e a hora devem estar no futuro.

Novo e Criar em uma conversa, no mesmo menu, abrem uma nova conversa no espaço de trabalho atual ou no mais recente. Peça ao modelo nessa conversa que crie a tarefa.

<a id="manage-tasks"></a>

<a id="inspect-run-and-delete-tasks"></a>

## Inspecionar, executar e excluir tarefas

Peça ao modelo para listar os lembretes de todas as conversas, com os ativos primeiro. Você também pode pedir que consulte, pause, retome ou exclua um lembrete pelo ID.

Abra as tarefas de automação na barra lateral para consultar lembretes de várias sessões sem ativar suas conversas. Pesquise pelo nome da tarefa, pela instrução ou pelo ID da conversa e filtre em Status da tarefa por Todos, Habilitado, Pausada ou Concluída. As linhas são ordenadas pelo horário agendado, do mais próximo ao mais distante. Cada linha mostra o nome da tarefa e um resumo com a frequência, o status se estiver pausada ou encerrada, ou o próximo horário agendado em formato local e relativo se estiver ativada.

Uma sessão inclui as tarefas que enviam entregas a ela, entre elas a execução mais recente de uma tarefa que cria uma conversa a cada vez, e as que seu agente criou ou editou. Se uma sessão estiver ociosa, não arquivada e tiver pelo menos uma tarefa ativa, sua linha mostra um relógio. A linha de uma sessão arquivada deixa essa célula vazia e só mostra seu estado atual ao manter o ponteiro sobre ela. Ao manter o ponteiro sobre uma linha com tarefas ativas, aparecem até duas tarefas com a frequência, o horário da próxima execução no fuso do dispositivo e o tempo restante. O cabeçalho da sessão aberta mostra um ícone de relógio enquanto houver tarefas ativas. Se houver uma única tarefa, o ícone abre os detalhes na barra lateral direita. Se houver várias, abre uma lista em que você pode abrir os detalhes ou excluir cada tarefa.

Selecione uma tarefa para abrir os detalhes. Regras mostra o nome, a próxima execução em horário local e relativo ou o status de uma tarefa pausada ou encerrada, a instrução, a repetição e o destino. Se a entrega for para uma conversa existente, o destino indica que a conversa vinculada atual será usada. Na parte inferior, aparece a sessão vinculada ou, se cada execução criar uma nova conversa, a conversa da última execução. O botão só fica disponível quando a sessão pode ser aberta e não está arquivada. Antes da primeira execução, o painel indica que a conversa ainda será criada. Para um destino existente, Regras informa se a conversa está arquivada, indisponível ou ainda carregando. Você pode consultar os detalhes e excluir a tarefa mesmo sem abrir a conversa. Consultar tarefas mantém as sessões arquivadas.

Abra Registros para carregar os 20 registros salvos mais recentes. Cada registro mostra o horário da entrega no fuso da regra, ou no do navegador se a regra não especificar um, e a instrução salva. Quando a conversa que recebeu a entrega está disponível, um botão permite abri-la. Use Expandir para ler uma instrução longa na íntegra. Os registros sem instrução salva nunca exibem a instrução atual no lugar dela. Carregar mais adiciona a próxima página. Os registros mantêm a ordem de gravação, do mais recente ao mais antigo, mesmo que o relógio volte. O resultado da execução do modelo não faz parte do registro. As setas esquerda e direita e as teclas Home e End mudam a aba em foco.

Se a tela de registros estiver vazia, a consulta foi concluída e não encontrou registros salvos. Há mensagens distintas para carregamento, falha na solicitação, tarefa ausente e cursor inválido de registros anteriores. Use Tentar novamente se a solicitação falhar ou a tarefa estiver ausente. Use Atualizar se o cursor for inválido para recarregar a página mais recente. Se uma solicitação falhar, registros já carregados podem continuar visíveis com um aviso. Uma nova entrega atualiza a primeira página. Respostas tardias de outra tarefa ou tela não substituem a tela atual.

Se a política de retenção removeu registros anteriores, a última página informa a remoção. As regras de retenção mostram quantos registros cada tarefa mantém e por quantos dias. Uma tarefa antiga sem histórico salvo exibe apenas sua última entrega, sem instrução, até que novas entregas gerem registros. Os registros anteriores e as cópias das instruções que não foram salvos são irrecuperáveis.

O Host agenda as tarefas ativas. Tarefas pausadas e encerradas não agendam novas entregas. Uma tarefa de execução única termina quando o lembrete é gravado de forma persistente na caixa de entrada da conversa. Uma tarefa recorrente termina após a última ocorrência prevista na regra. Para encontrar tarefas encerradas, filtre por Todos ou Concluída. O relógio do cabeçalho, a marca na linha da sessão e as informações exibidas ao manter o ponteiro mostram apenas tarefas ativas. Para verificar se uma tarefa foi excluída, consulte a lista.

Nos detalhes, Pausar interrompe as entregas futuras e Retomar reativa uma tarefa pausada. Executar agora, no menu de ações, pede ao Host uma entrega imediata da instrução e preserva a próxima execução agendada, inclusive em tarefas pausadas ou encerradas. Enquanto uma entrega para uma conversa existente ou para uma única conversa nova estiver na fila ou em execução, os campos e as ações Salvar alterações, Pausar, Retomar, Executar agora e Excluir tarefa ficam desabilitados. Os detalhes informam o estado e direcionam você à conversa, que pode ser aberta pelo botão inferior. Se cada execução criar uma nova conversa, as execuções podem continuar em paralelo sem esse bloqueio. Depois da entrega, Executar agora fica desabilitado até passar o intervalo mínimo. Se o intervalo for a única restrição, mantenha o ponteiro sobre o botão ou mova o foco do teclado até ele para ver quando estará disponível. Se o Host recusar a execução, os detalhes informam que a tarefa está na fila, em execução ou acabou de ser entregue. Executar agora também fica desabilitado enquanto a conversa de destino estiver arquivada. Se você interromper a conversa enquanto a instrução estiver na fila, ela continua aguardando a próxima mensagem, a próxima execução agendada ou uma execução manual.

No menu de ações, selecione Excluir tarefa e confirme para removê-la da lista e cancelar entregas futuras, inclusive se estiver pausada ou encerrada. Os registros de entrega também são excluídos. Após a confirmação, o aplicativo exibe um aviso com o resultado. Em caso de sucesso, os detalhes são fechados. Em caso de falha, a tarefa permanece disponível para uma nova tentativa. A exclusão preserva as conversas e as mensagens que já estão na fila. A linha permanece visível até que uma consulta bem-sucedida confirme as tarefas restantes. Se a consulta falhar, use Tentar novamente para recarregar o catálogo. Um erro de consulta não confirma que a lista está vazia.

<a id="edit-timing"></a>

<a id="edit-a-task"></a>

## Editar uma tarefa

Peça ao modelo para alterar o nome, a instrução, a regra de repetição ou o destino de um lembrete, ou para pausá-lo ou retomá-lo. A alteração preserva o ID e os registros de entrega salvos.

Nas tarefas de automação, selecione uma tarefa, mesmo pausada ou encerrada, para mudar o nome, a instrução, o destino, o espaço de trabalho vinculado ou o horário. As alterações ficam em um rascunho local até você clicar em Salvar alterações. A edição preserva o ID, o comprovante de entrega mais recente e todos os registros salvos. Alterar a regra reativa uma tarefa encerrada e mantém pausada uma tarefa pausada. O destino de uma tarefa que entrega a uma conversa existente exibe a conversa vinculada atual. Se você escolher outra opção, as execuções seguintes criarão suas conversas e o espaço de trabalho vinculado voltará ao valor inicial, como na criação manual. A tarefa mantém a predefinição enquanto usar o mesmo espaço de trabalho. Se você alterar o espaço de trabalho, a tarefa usará a predefinição padrão.

- Uma vez. Data abre um calendário mensal e Hora abre as colunas Hora, Minuto e Segundo. O fuso horário é usado para interpretar a data e a hora. A tarefa termina depois de executar uma vez.
- A cada N minutos e A cada N horas. Defina um intervalo de pelo menos um minuto ou uma hora, conforme a unidade. A contagem começa no minuto em que você salva a tarefa.
- Todos os dias. Intervalo define o número de dias. Hora abre as colunas Hora e Minuto.
- Semanal e De segunda a sexta-feira. Intervalo define o número de semanas e Dia da semana permite escolher os dias. Hora abre as colunas Hora, Minuto e Segundo. De segunda a sexta-feira seleciona os cinco dias de uma vez.
- Mensal. Intervalo define o número de meses e Dia do mês permite escolher de 1 a 31. Hora abre as colunas Hora, Minuto e Segundo. Se a data não existir em um mês, a tarefa será executada no último dia daquele mês.
- Personalizado. Regra personalizada contém o texto da regra. Regras que as outras opções não podem reproduzir abrem em Personalizado. Se uma tarefa existente não tiver um texto de regra editável, ela mostra a frequência original e preserva o horário até você salvar uma nova regra.

O seletor de fuso horário mostra primeiro os fusos escolhidos recentemente, marca o fuso do sistema e permite buscar por deslocamento UTC, ID IANA ou cidade. Ele aparece nas opções guiadas e nas expressões personalizadas que usam um fuso separado. Nos demais casos, o texto da regra personalizada define o fuso.

Os campos alteram apenas o rascunho local. Se o destino for uma conversa existente, a sessão vinculada atual continua disponível para desfazer uma mudança de destino sem descartar as demais edições. Durante a edição, a parte inferior dos detalhes indica que há alterações não salvas e mostra Descartar e Salvar alterações. Salvar alterações envia apenas os campos alterados em uma única atualização, e Descartar restaura os valores salvos. Uma nova regra só é enviada se o horário mudar. Salvar alterações fica disponível quando há uma mudança efetiva e os campos e o horário são válidos. Se o texto personalizado for inválido, o rascunho é preservado e aparece uma mensagem de correção. O Host também valida a regra ao salvar. Para pausar, retomar, executar agora ou excluir, salve ou descarte o rascunho primeiro. Os campos ficam desabilitados durante a gravação. Sair dos detalhes não desfaz uma gravação que o Host já iniciou.

Trocar de tarefa ou sair da página preserva os rascunhos. Ao atualizar o catálogo, um formulário sem alterações é atualizado, e um formulário editado preserva os campos e a versão original. Se uma entrega ou outra edição mudar a tarefa, os detalhes avisam e desabilitam Salvar alterações quando a versão mais recente chega. O Host também verifica a versão ao salvar. Revisar com minhas alterações preserva os grupos editados entre título, instrução, horário e destino e carrega os valores mais recentes para os outros grupos. Se outra edição alterar o mesmo grupo, a sua edição prevalece no formulário. Revise o formulário inteiro antes de salvar. Essa ação apenas prepara o formulário. Descartar substitui todo o rascunho pelos últimos valores salvos. Se a gravação voltar a falhar, o rascunho permanece e os detalhes oferecem uma nova tentativa. Antes de repetir uma atualização de resultado desconhecido, confira a tarefa. Uma atualização aceita recarrega o catálogo. Respostas tardias não substituem a tela atual após fechar os detalhes ou mudar de tarefa.

<a id="timing-and-delivery"></a>

<a id="timing-and-delivery-reference"></a>

## Referência de horários e entregas

Os lembretes continuam armazenados mesmo que a sessão esteja fechada. Enquanto está em execução, o Host restaura ou cria a sessão de destino na hora do lembrete e coloca a mensagem de acompanhamento na fila sem interromper o trabalho em andamento. Ao reiniciar, ele verifica as tarefas salvas e envia uma tarefa de execução única atrasada ou apenas a ocorrência perdida mais recente de cada tarefa recorrente. Fechar o Host interrompe o agendamento até que ele seja iniciado de novo. Tarefas recorrentes pendentes para a mesma sessão podem compartilhar uma mensagem.

Uma regra de repetição com fuso IANA segue o horário local. Se um horário local não existir, a regra o ignora. Se o horário local se repetir, a regra usa o primeiro dos dois instantes. Tarefas existentes mantêm seu horário até que você salve uma regra nova. Um lembrete de intervalo fixo mantém como referência seu horário de criação. Um lembrete diário, semanal ou cron segue os horários locais salvos no fuso IANA. O navegador fornece seu fuso para interpretar pedidos em linguagem natural. Indique um fuso explicitamente para evitar ambiguidade. A página de tarefas de automação mostra a próxima execução no fuso do navegador. O texto da frequência indica o fuso da regra quando ele difere do fuso do navegador. Se a regra não especificar um fuso, será usado o do navegador.

Um registro de entrega confirma que a mensagem foi gravada na caixa de entrada da conversa. O registro não indica se o modelo concluiu o trabalho solicitado. Se falhar a gravação na caixa de entrada ou na tarefa, nenhum registro é adicionado. Se o processo cair ou a gravação da tarefa falhar depois de gravar a mensagem na caixa de entrada, a entrega pode ficar sem registro e se repetir. O Host não garante entrega exatamente uma vez. Fechar o Host descarta as mensagens que ainda aguardam na caixa de entrada da conversa. O registro é preservado, mas o modelo nunca recebe a mensagem e o Host não a envia de novo. Os registros servem para consultar entregas. O histórico de execução e as notificações externas ficam fora desse mecanismo.

Ao adicionar um comprovante de entrega, o Host elimina registros antigos. Ele mantém, no máximo, os `deliveryHistoryRecords` registros mais recentes cujo horário de confirmação esteja dentro da janela `deliveryHistoryDays`, contada para trás a partir do `deliveredAt` do comprovante recém-adicionado. O último comprovante é sempre preservado, e a remoção indica que os registros anteriores estão indisponíveis. O Host mantém o histórico preservado em memória e regrava toda a linha da tarefa a cada confirmação. A paginação limita a quantidade de registros devolvidos, sem limitar o histórico preservado ou o tamanho das instruções.

O modelo usa `schedule_edit` e a página de tarefas de automação oferece os mesmos controles para editar nome, instrução, horário ou destino, pausar e retomar qualquer lembrete. Ambas as opções gerenciam a tarefa sem repassar trabalho entre sessões. Cada alteração adiciona um aviso à próxima solicitação ao modelo em cada conversa envolvida cujo agente esteja carregado, exceto na conversa que fez a alteração. O Host não agenda automaticamente lembretes gravados apenas em um log de sessão antigo. Recrie os que ainda forem necessários. O Host não reconstrói registros de tarefas excluídas.

<a id="further-exploration"></a>
## Saiba mais

- [Referência de agendamento](../../../packages/schedule/schedule/README.md) documenta os campos da tarefa, os destinos de entrega, regras de recorrência, persistência e limites de entrega.
- [Referência da página de tarefas de automação](../../../packages/client/ui-schedule/README.md) descreve a página global e catálogo no cabeçalho da conversa.

<a id="dev-note"></a>

## Nota de desenvolvimento

Nenhuma.
