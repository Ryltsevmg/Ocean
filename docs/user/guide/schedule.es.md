<a id="schedule-reminders"></a>

# Recordatorios de calendario

<!-- USER_LANGUAGES_START -->
[English](schedule.md) | [中文](schedule.zh.md) | [Русский](schedule.ru.md) | [日本語](schedule.ja.md) | Español | [Français](schedule.fr.md) | [Deutsch](schedule.de.md) | [Português](schedule.pt.md) | [한국어](schedule.ko.md)
<!-- USER_LANGUAGES_END -->

<a id="summary"></a>

## Resumen

Pregúntele al modelo en una conversación para crear, listar, ver, editar, pausar, reanudar o eliminar recordatorios. Cada recordatorio repite por su regla y entrega su instrucción a una conversación existente, a una nueva conversación, o a una nueva conversación en cada ocurrencia. La página de tareas de automatización lista cada recordatorio del host y puede crear, editar, ejecutar, pausar, reanudar y eliminar uno. Se entregan tareas de un solo disparo permanecen disponibles hasta que se eliminan explícitamente.

<a id="table-of-contents"></a>

## Cuadro de contenidos

- [Crear recordatorios](#create-reminders)
- [Inspeccionar, ejecutar y eliminar tareas](#manage-tasks)
- [Editar una tarea](#edit-timing)
- [Referencia de la fecha y la entrega](#timing-and-delivery)
- [Further Exploration](#further-exploration)

<a id="create-reminders"></a>
## Crear recordatorios

El perfil Web enviado incluye el servicio de Programación de Alojamientos y la página de tareas de Automatización. Configurar un proveedor de modelos antes de pedirle que cree recordatorios.

Los presets `standard`, `cordis`, y `ptc` declaran las cuatro herramientas de recordatorio y el contexto del reloj que da al modelo el tiempo actual y la zona del navegador, por lo que los presets proporcionan `schedule_create`, `schedule_list`, `schedule_view`, y `schedule_edit`; el preset `minimal` no declara ninguno. Un subagente delegado ve las cuatro herramientas, pero cada herramienta rechaza una llamada de un subagente delegado, por lo que un subagente no puede leer ni cambiar recordatorios.

Pida al modelo que cree, lista, vea, edite, pare, reanude o borre recordatorios. Utiliza `schedule_create` para crear uno, `schedule_list` para enumerar los recordatorios de cada conversación, `schedule_view` para leer uno, y `schedule_edit` para cambiar, pausar, reanudar o eliminar uno; una edición mantiene el recordatorio id y guardar los registros de entrega. Un recordatorio de que el modelo crea tiene un nombre, una instrucción, un tiempo de inicio en UTC o en una zona horaria de IANA, y una regla de repetición RFC 5545, como todos los días de semana a las 09:00 o sólo una vez. Se entrega a esta conversación, a una nueva conversación que su primera entrega crea, o a una nueva conversación en cada entrega; una nueva conversación utiliza el directorio de trabajo y preestablecido de esta conversación. Cada entrega de un recordatorio viene al menos un minuto después de la hora programada de la entrega anterior, o después de la Runa anterior ahora; un recordatorio que abre una nueva conversación en cada entrega espera para el intervalo de ejecución mínimo del huésped en lugar, un minuto por defecto. Una entrega tardía, por ejemplo después de un reinicio de Host, no retrasa el siguiente.

Una conversación que crea una entrega se une al espacio de trabajo registrado en su directorio de trabajo y toma el nombre de recordatorio como su título. Para un recordatorio que abre una nueva conversación en cada entrega, el título también indica el tiempo de lanzamiento en la zona de la regla del recordatorio, por ejemplo `Weekday digest · 2026-10-12 09:00`.

Por ejemplo, pregunte: “Recuérdame todos los días a las 23:00 en Asia/Shanghai para comprobar el tiempo”. Debajo de la respuesta, una tarjeta muestra el nombre y la frecuencia del recordatorio creado; Open muestra sus detalles en la barra lateral derecha. Comprueba que la frecuencia se repite todos los días a las 23:00, no una vez. Un recordatorio de una sola vez no se vuelve recurrente después de la entrega. Después de que se elimina el recordatorio, la tarjeta muestra Borrado y ya no la abre.

Para crear un recordatorio sin el modelo, abra tareas de automatización desde la barra lateral, abra Elija un método de creación junto a New, y elija Crear manualmente; cuando no existe ninguna tarea, Nueva tarea de automatización abre el mismo editor. Este editor también abre las tareas existentes y pide un nombre de tarea de automatización, una instrucción de tareas de automatización, ejecutar, enlace del espacio de trabajo y correr el tiempo. Comienza con Una vez a una hora de ahora en la zona horaria del navegador y con Crear una conversación y reutilizarla. Ejecutar en ofertas Crear una conversación y reutilizarla, lo que crea una conversación en la primera carrera y la sigue utilizando, y Nueva conversación para cada carrera, lo que crea una conversación separada en cada carrera y muestra el intervalo mínimo de funcionamiento del Host. El espacio de trabajo vinculado lista cada espacio de trabajo registrado con su directorio y selecciona el espacio de trabajo cuyo directorio utiliza la nueva conversación; comienza en el espacio de trabajo predeterminado, o en el primer espacio de trabajo cuando el espacio de trabajo predeterminado no está registrado. Cuando no existe espacio de trabajo, Linked Workspace muestra Ungrouped y se utiliza el directorio del proyecto Host. La nueva conversación utiliza el preset predeterminado. Crear crea la tarea y la selecciona en la lista, y Discard cierra el editor sin crear uno. Si el Host rechaza la tarea, el editor mantiene su entrada y declara el problema, por ejemplo, que la fecha y hora deben estar en el futuro.

Nuevo, y Crear en una conversación en el mismo menú, abrir una nueva conversación en el espacio de trabajo actual o más reciente; pedir al modelo allí para crear la tarea.

<a id="manage-tasks"></a>

<a id="inspect-run-and-delete-tasks"></a>

## Inspeccionar, ejecutar y eliminar tareas

Pida al modelo que lista recordatorios para ver los recordatorios de cada conversación, activa primero, o para mostrar, pausar, reanudar o eliminar un recordatorio por su id.

Abrir tareas de automatización desde la barra lateral para ver recordatorios a través de Sesiones sin activar sus conversaciones. Buscar por el nombre de tarea, la instrucción, o el id de la conversación de la tarea, y filtrar por el estado de tarea: Todo, Activado, Pausado o Ended. Las filas son ordenadas por su hora programada, antes primero. Cada fila muestra el nombre de tarea y una línea sumaria: el estado de una tarea pausada o terminada, la frecuencia y, para una tarea habilitada, la próxima hora programada con su tiempo local y relativo.

Las tareas de una sesión son las tareas que le entregan, incluyendo la última ejecución de una tarea que crea una nueva conversación para cada carrera, y las tareas que su Agente creó o editó. Una hilera de sesión inesperada cuya sesión tiene al menos una tarea activa muestra una marca de reloj; una fila archivada mantiene esa celda en blanco, con su estado de vida en la tarjeta de arrastre solamente. Una larga palanca en una fila de sesión con tareas activas lista hasta dos de esas tareas con su frecuencia y su próximo funcionamiento como una zona de dispositivo con su duración relativa. El encabezado de la sesión abierta muestra un reloj de recordatorio sólo icono mientras que la sesión tiene tareas activas: abre los detalles de la única tarea en la barra lateral derecha, o de otra manera una lista de las tareas en las que cada fila abre los detalles de la tarea o elimina la tarea.

Seleccione una tarea para abrir sus detalles. Las reglas muestran el nombre de la tarea, Siguiente corre con su tiempo local y relativo o el estado de una tarea pausada o terminada, la instrucción, Repetir y Ejecutar, que muestra la conversación vinculada actual para una tarea que se entrega a una conversación existente. La parte inferior de los detalles muestra sesión enlazada, o última conversación de ejecución para una tarea que crea una nueva conversación para cada carrera. Su botón abre esa conversación cuando la sesión está disponible y no está anclada, y está deshabilitada de otra manera; antes de la primera carrera crea la conversación, la entrada muestra la creación de la espera. Para una tarea que se entrega a una conversación existente, Reglas declara cuando esa conversación es archivada, indisponible o todavía cargada. Los detalles de la tarea y la eliminación permanecen disponibles incluso cuando una conversación no puede abrirse. Las tareas de crecimiento no son sesiones inarquívocas.

Elija Registros para cargar los más recientes 20 registros guardados. Cada registro muestra el tiempo de ocurrencia en la zona de la regla de la tarea (la zona del navegador cuando la regla no nombre ninguno), un botón que abre la conversación que recibió la entrega cuando esa conversación está disponible, y la instrucción guardada; Expand muestra una larga instrucción en su totalidad. Los registros sin una instrucción salva nunca muestran la instrucción actual en su lugar. La carga más añade la siguiente página. Los registros siguen el orden guardado más reciente, incluso si el reloj se mueve hacia atrás; no describen los resultados de ejecución modelo. Las flechas izquierda/derecha y Inicio/End cambian las pestañas enfocadas.

Una vista de registro vacía significa que una consulta exitosa no devolvió registros guardados. Carga, solicitud de fallo, una tarea perdida, y un cursor de disco de disco antiguo inválido tienen mensajes separados. Use Retry después de una solicitud fallida o respuesta de la prueba perdida; use Refresh después de un cursor inválido para volver a cargar la página más reciente. Los registros previamente cargados pueden permanecer visibles con una advertencia mientras una solicitud falla. Una nueva última entrega refresca la página más reciente. Las respuestas tardías para una tarea o vista que ha dejado no sustituyen la opinión actual.

Cuando la retención removió registros anteriores, la última página indica que los registros anteriores de entrega han sido aclarados, y las reglas de Retención muestran cuántos registros y cuántos días cada tarea guarda. Una tarea más antigua sin historia guardada muestra sólo su última entrega, sin instrucción, hasta que nuevas entregas añadan registros. Los registros anteriores no guardados y las instantáneas de instrucciones no se pueden recuperar.

Las tareas activas participan en la programación. Las tareas fusionadas y terminadas no programan otra entrega. Una tarea de una sola vez termina después de que su recordatorio esté escrito duramente a la bandeja de entrada de conversaciones, y una tarea de repetición termina después de la última ocurrencia de su regla; elegir All or Ended in Task status para encontrar una tarea finalizada. El reloj del encabezado de sesión, el marcado de filas y la tarjeta de hover muestran sólo tareas activas, por lo que la desaparición de esas opiniones no significa que la tarea fue eliminada.

La pausa en los detalles detiene las futuras entregas de una tarea activa, y Resume reinicia una tarea pausada. Ejecutar ahora, en el menú de acciones de tareas de automatización, pide al anfitrión que proporcione la instrucción una vez ahora y mantenga la próxima ejecución programada, también para una tarea pausada o terminada. Mientras que una entrega de una tarea que se entrega a una conversación existente o a una nueva conversación se apaga o se ejecuta, los campos, Guardar cambios, Pausa, Resume, Correr ahora, y Eliminar tareas son deshabilitados, y los detalles indican que la tarea se apaga o se ejecuta y que la administra en su conversación, que el botón en la parte inferior de los detalles se abre. Una tarea que crea una nueva conversación para cada carrera no es deshabilitada de esta manera; sus carreras continúan entre sí. Después de una entrega, Run ahora se mantiene desactivado hasta que el intervalo mínimo de entrega de la tarea termina; mientras que sólo el intervalo lo sostiene, mantenga el puntero en Run ahora o mueva el teclado a él para ver cuando se pone disponible. Si el Host rechaza una carrera por una de estas razones, los detalles indican que la tarea es demandada, ejecutada o acaba de ser entregada. Correr ahora también es deshabilitado mientras la conversación que la tarea entrega es archivada. Si detienes la conversación mientras la instrucción de la tarea espera allí, la instrucción se mantiene presionada hasta que tu próximo mensaje, la tarea es la siguiente ejecución programada, o Run ahora comienza.

Elija Eliminar la tarea del menú de acciones de tareas de automatización y confirme parar la entrega futura y eliminar la tarea de la lista, incluyendo para una tarea pausada o terminada. La eliminación elimina la tarea junto con sus registros de entrega guardados, por lo que la historia salva de la tarea se ha ido. Confirmando la supresión reporta el resultado en un aviso a nivel de toda la aplicación - eliminado, que también cierra los detalles, o un fracaso que deja la tarea en marcha para volver a entrar; no elimina las conversaciones o retrae un mensaje ya consultado allí. La fila se mantiene visible hasta que una consulta exitosa confirma las tareas restantes. Si una consulta falla, Retry vuelve a cargar el catálogo; el error no es un resultado vacío exitoso.

<a id="edit-timing"></a>

<a id="edit-a-task"></a>

## Editar una tarea

Pida al modelo que cambie el nombre, instrucción, regla de repetición o objetivo de entrega, o que lo detenga o lo reanude; el cambio mantiene el recordatorio id y guarda los registros de entrega.

En tareas de automatización, seleccione una tarea para cambiar su nombre de tarea de automatización, instrucción de tareas de automatización, ejecutar, espacio de trabajo vinculado y correr tiempo, incluyendo una tarea pausada o terminada. Edita permanecer en un borrador local hasta que elija Guardar cambios. Editar mantiene la tarea id, el último recibo de entrega, y todos los registros de entrega guardados. Una regla cambia hace que una tarea terminada sea activa de nuevo y mantiene una tarea pausada pausada. Para una tarea que se entrega a una conversación existente, Ejecutar en muestra Conversación enlazada actual; elegir otra opción hace que las carreras posteriores crean sus conversaciones y establece el espacio de trabajo enlazado a su valor inicial, como en Crear manualmente. Una tarea mantiene su preset almacenado mientras que su espacio de trabajo permanece igual; un espacio de trabajo cambiado utiliza el preset predeterminado.

- Una vez: La fecha abre un calendario de mes, el Tiempo abre Hora, Minuto y Segunda columnas, y la Zona del Tiempo los interpreta. La tarea se ejecuta una vez y luego termina.
- Cada N minutos y cada N horas: Interval establece el número de minutos o horas, por lo menos 1. El intervalo cuenta desde el minuto en que se guarda la tarea.
- Cada día: Interval establece el número de días, y el Tiempo abre las columnas Hora y Minuto.
- Semanal y de lunes a viernes: Interval establece el número de semanas, el día de semana selecciona los días, y el tiempo abre Hora, Minuto y Segundo columnas. Lunes a viernes selecciona esos cinco días a la vez.
- Mensual: Interval establece el número de meses, el día del mes selecciona una fecha de 1 a 31, y el tiempo abre Hora, Minuto y Segundo columnas. Un mes sin la fecha seleccionada se ejecuta en su último día.
- Personalizado: Regla personalizada contiene el texto de la regla. Una regla que las otras opciones no pueden reproducirse abre en la aduana. Una tarea existente sin texto de regla editable muestra su frecuencia original y mantiene ese momento hasta que se ahorra un reemplazo.

Listas de zona horaria recientemente seleccionadas zonas primero, marca la zona del sistema, y búsquedas por UTC offset, IANA ID, o ciudad. Se presenta para opciones guiadas y expresiones personalizadas que utilizan una zona separada; de lo contrario el texto de regla personalizada suministra su zona.

Los campos cambian sólo un borrador local. Si la tarea se dirige a una conversación existente, la sesión actual enlazada sigue disponible para que pueda deshacer un cambio de destino sin descartar otras ediciones. Mientras editas, la parte inferior de los detalles muestra cambios sin guardar y desvelar cambios; Guardar cambios envía sólo los campos cambiados en una sola actualización, y Discard restaura los valores almacenados. Un ahorro envía una nueva regla sólo cuando el tiempo cambió. Guardar cambios se mantiene deshabilitado hasta que un cambio significativo tiene campos válidos y tiempo. El texto personalizado inválido mantiene el borrador y muestra un mensaje de corrección; el anfitrión también valida la regla sobre guardar. Pausa, reanudar, Correr ahora, y la eliminación espera hasta que guardes o descartes los cambios sin salvar. Los campos están desactivados mientras un ahorro está en vuelo. Dejar los detalles no hace rodar un Host escribe ya comenzado.

Cambiar tareas o salir de la página mantiene borradores sin guardar. Una actualización de catálogo actualiza una forma prístina; una forma editada mantiene todos los campos y su versión original. Si la entrega u otra edición cambia la tarea, los detalles indican que la tarea cambió en otro lugar y deshabilitar Guardar cambios cuando llegue la versión más reciente. El Host también revisa la versión ahorrada. Revisar con mis ediciones mantiene el título, la rapidez, el tiempo y los grupos de destino que cambiaste y carga los últimos valores para los otros grupos. Revise toda la forma antes de salvar; esta acción por sí sola no salva. Si el mismo grupo cambió en otro lugar, sus ediciones tienen precedencia en el formulario. Discard reemplaza todo el borrador con los últimos valores almacenados. Si otro ahorro falla, el borrador se queda y los detalles le piden que lo intente de nuevo; revise la tarea antes de volver a iniciar una actualización cuyo resultado es desconocido. Una actualización aceptada actualiza el catálogo. Las respuestas tardías después de cerrar detalles o cambiar tareas no reemplazan la vista actual.

<a id="timing-and-delivery"></a>

<a id="timing-and-delivery-reference"></a>

## Referencia de la fecha y la entrega

Los recordatorios permanecen almacenados cuando su sesión no está abierta. Mientras el anfitrión corre, restaura o crea la sesión de destino cuando un recordatorio se hace debido y espera un seguimiento sin interrumpir el trabajo actual. Reiniciar los cheques almacenados tareas y envía una instantánea excesiva o sólo la última ocurrencia perdida de cada tarea recurrente. Cerrar el Host deja de programar hasta que empiece de nuevo. Las debidas tareas recurrentes para la misma sesión pueden compartir un mensaje.

Una regla de repetición en una zona de IANA sigue el tiempo de la pared local: se salta una hora local que no existe y utiliza el instante anterior de una hora local repetida. Las tareas existentes mantienen su tiempo hasta que se ahorra una nueva regla: un recordatorio de tarifa fija permanece alineado a su tiempo de creación, y un recordatorio diario, semanal o cron sigue sus tiempos locales guardados en su zona de IANA. El navegador suministra su zona para interpretar las solicitudes de lengua natural; nombrar una zona evita explícitamente la ambigüedad. La página de tareas de automatización muestra cada siguiente funcionamiento como un reloj de la zona del navegador, y el texto de frecuencia denomina zona de una regla cuando difiere de la zona del navegador; una regla que no nombre zona utiliza la zona del navegador.

Los registros de entrega guardados confirman que los mensajes persisten en la bandeja de entrada de conversaciones, no que el modelo completó el trabajo solicitado. Permanencia de la caja de entrada fallida o la tarea escribe no añadir registro guardado. Un fallo o una falla de escritura de tareas después de la persistencia de la bandeja de entrada puede dejar un mensaje entregado sin grabar y repetir una entrega; exactamente una vez que la entrega no está garantizada. Cierre el Host descarta cada mensaje que aún espera en una caja de conversación: su registro guardado permanece, el modelo nunca recibe ese mensaje, y el Host no lo envía de nuevo. Esto no es un historial de ejecución o un canal de notificación externa.

Los registros guardados son podados cuando se adjunta un reconocimiento: el Host mantiene los registros cuyo tiempo de reconocimiento se encuentra dentro de la ventana `deliveryHistoryDays` configurada, medido de nuevo desde el `deliveredAt`del recibo adjunto, y en la mayoría de los registros `deliveryHistoryRecords` más recientes. El último recibo siempre sobrevive, y una ventana podrida marca registros anteriores no disponibles. El anfitrión mantiene la historia retenida en memoria y reescribe la fila de tareas completa para cada reconocimiento. Pagination limits returned record count, not the kept history or instruction bytes.

El nombre, la instrucción, el tiempo y la edición de objetivos, el pausing y la reanudación están disponibles para el modelo a través de `schedule_edit` y a la página de tareas de automatización para cada recordatorio; tampoco es un flujo de trabajo de relé cruzado. Un cambio añade un aviso a la siguiente solicitud modelo de cada conversación involucrada cuyo Agente está cargado, excepto la conversación que hizo el cambio. Los recordatorios registrados sólo en un registro de sesión más antiguo no están programados automáticamente; recrea los que todavía necesita. Los registros de tareas eliminados anteriormente no se reconstruyen.

<a id="further-exploration"></a>
## Further Exploration

- [Referencia programada](../../../packages/schedule/schedule/README.md) documenta campos de tareas, objetivos de entrega, reglas de recurrencia, persistencia y límites de entrega.
- [Tareas de automatización página de referencia](../../../packages/client/ui-schedule/README.md) describe la página global y el catálogo de encabezados por conversaciones.

<a id="dev-note"></a>

## Nota de Dev

Ninguno.
