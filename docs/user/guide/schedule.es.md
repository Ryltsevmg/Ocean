<a id="schedule-reminders"></a>

# Programar recordatorios

<!-- USER_LANGUAGES_START -->
[English](schedule.md) | [中文](schedule.zh.md) | [Русский](schedule.ru.md) | [日本語](schedule.ja.md) | Español | [Français](schedule.fr.md) | [Deutsch](schedule.de.md) | [Português](schedule.pt.md) | [한국어](schedule.ko.md)
<!-- USER_LANGUAGES_END -->

<a id="summary"></a>

## Resumen

Pide al modelo en una conversación que cree, liste, consulte, edite, pause, reanude o elimine recordatorios. Cada recordatorio sigue su regla de repetición y entrega la instrucción a una conversación existente, a una única conversación nueva o a una conversación nueva en cada ejecución. La página de tareas de automatización muestra todos los recordatorios del Host y permite crearlos, editarlos, ejecutarlos, pausarlos, reanudarlos y eliminarlos. Las tareas de una sola ejecución siguen disponibles tras la entrega hasta que las elimines expresamente.

<a id="table-of-contents"></a>

## Índice

- [Crear recordatorios](#create-reminders)
- [Inspeccionar, ejecutar y eliminar tareas](#manage-tasks)
- [Editar una tarea](#edit-timing)
- [Referencia de horarios y entregas](#timing-and-delivery)
- [Más información](#further-exploration)

<a id="create-reminders"></a>
## Crear recordatorios

El perfil Web incluido incorpora el servicio de programación del Host y la página de tareas de automatización. Configura un proveedor de modelos antes de pedirle que cree recordatorios.

Los perfiles predefinidos `standard`, `cordis` y `ptc` declaran las cuatro herramientas de recordatorios y el contexto de reloj que proporciona al modelo la hora actual y la zona horaria del navegador. Esos perfiles incluyen `schedule_create`, `schedule_list`, `schedule_view` y `schedule_edit`. El perfil `minimal` prescinde de ambas funciones. Los subagentes delegados ven las cuatro herramientas, pero estas rechazan sus llamadas, por lo que no pueden leer ni cambiar recordatorios.

Pide al modelo que cree, liste, consulte, edite, pause, reanude o elimine recordatorios. Usa `schedule_create` para crear, `schedule_list` para listar los de todas las conversaciones, `schedule_view` para consultar y `schedule_edit` para modificar, pausar, reanudar o eliminar. Editar conserva el ID y los registros de entrega guardados. El recordatorio tiene un nombre, una instrucción, una hora de inicio en UTC o en una zona IANA y una regla RFC 5545, por ejemplo, todos los días laborables a las 09:00 o una sola vez. El destino puede ser esta conversación, una sola conversación nueva que se crea en la primera entrega o una nueva en cada entrega. Las conversaciones nuevas usan el directorio de trabajo y el perfil predefinido de esta conversación. Debe transcurrir al menos un minuto desde la hora programada de la entrega anterior o desde la última ejecución manual. Si se crea una conversación nueva en cada entrega, rige el intervalo mínimo de ejecución del Host, de un minuto por defecto. Una entrega tardía, por ejemplo tras un reinicio del Host, no retrasa la siguiente.

La conversación creada en una entrega se incorpora al espacio de trabajo registrado para su directorio y toma el nombre del recordatorio como título. Si cada entrega crea una conversación, el título también indica la hora de inicio en la zona horaria de la regla, por ejemplo `Weekday digest · 2026-10-12 09:00`.

Por ejemplo, pide «Recuérdame todos los días a las 23:00 en Asia/Shanghai que consulte el pronóstico del tiempo». Debajo de la respuesta, una tarjeta muestra el nombre y la frecuencia del recordatorio. Pulsa Abrir para ver los detalles en la barra lateral derecha. Comprueba que se repita todos los días a las 23:00. Un recordatorio de una sola vez no se vuelve recurrente tras la entrega. Cuando lo eliminas, la tarjeta indica Eliminado y deja de abrirlo.

Para crear un recordatorio sin usar el modelo, abre las tareas de automatización en la barra lateral, selecciona Elegir método de creación junto a Nuevo y elige Crear manualmente. Si no hay tareas, Nueva tarea de automatización abre el mismo editor. El editor también abre tareas existentes y pide el nombre, la instrucción, el destino, el espacio de trabajo vinculado y el horario. La configuración inicial es una sola ejecución dentro de una hora en la zona del navegador y una conversación nueva que se reutiliza. Puedes reutilizar la conversación creada en la primera ejecución o crear una nueva en cada ejecución. La segunda opción muestra el intervalo mínimo de ejecución del Host. El selector de espacios de trabajo muestra los espacios registrados y sus directorios. La conversación nueva usa el directorio del espacio seleccionado. El editor selecciona el espacio predeterminado o, si no está registrado, el primero. Si no hay espacios de trabajo, el editor indica que no hay grupo y usa el directorio del proyecto del Host. La nueva conversación usa el perfil predefinido predeterminado. Crear añade y selecciona la tarea, mientras que Descartar cierra el editor sin crearla. Si el Host rechaza la tarea, el editor conserva lo que has introducido e indica el problema, por ejemplo, que la fecha y la hora deben estar en el futuro.

Nuevo y Crear en una conversación, en el mismo menú, abren una conversación nueva en el espacio de trabajo actual o en el más reciente. Pide allí al modelo que cree la tarea.

<a id="manage-tasks"></a>

<a id="inspect-run-and-delete-tasks"></a>

## Inspeccionar, ejecutar y eliminar tareas

Pide al modelo que liste los recordatorios de todas las conversaciones, con los activos primero. También puedes pedirle que consulte, pause, reanude o elimine un recordatorio por su ID.

Abre las tareas de automatización en la barra lateral para consultar recordatorios de varias sesiones sin activar sus conversaciones. Busca por nombre de tarea, instrucción o ID de conversación y filtra en Estado de la tarea mediante Todos, Habilitado, Pausada o Finalizada. Las filas se ordenan de la hora programada más próxima a la más lejana. Cada fila muestra el nombre de la tarea y una línea con su frecuencia, el estado si está pausada o finalizada, o la próxima hora programada en formato local y relativo si está activada.

Una sesión incluye las tareas que le envían entregas, entre ellas la ejecución más reciente de una tarea que crea una conversación cada vez, y las que creó o editó su agente. Si una sesión está inactiva, sin archivar y tiene al menos una tarea activa, su fila muestra un reloj. La fila de una sesión archivada deja esa celda vacía y solo muestra su estado actual al mantener el puntero sobre ella. Si mantienes el puntero sobre una fila con tareas activas, verás hasta dos tareas con su frecuencia, la próxima ejecución en la zona horaria del dispositivo y el tiempo que falta. La cabecera de la sesión abierta muestra un icono de reloj si hay tareas activas. Si hay una sola, el icono abre sus detalles en la barra lateral derecha. Si hay varias, abre una lista desde la que puedes abrir los detalles o eliminar cada tarea.

Selecciona una tarea para abrir sus detalles. En Reglas aparecen el nombre, la próxima ejecución en formato local y relativo o el estado de la tarea pausada o finalizada, la instrucción, la repetición y el destino. Si la entrega va a una conversación existente, el destino indica que se usa la conversación vinculada actual. Al pie aparece la sesión vinculada o, si cada ejecución crea una conversación nueva, la conversación de la última ejecución. Su botón solo se habilita cuando la sesión está disponible y sin archivar. Antes de la primera ejecución se indica que la conversación está pendiente de creación. Para un destino existente, Reglas indica si la conversación está archivada, no está disponible o sigue cargando. Aunque la conversación no se pueda abrir, puedes consultar los detalles y eliminar la tarea. Consultar tareas mantiene las sesiones archivadas.

Abre Registros para cargar los 20 registros guardados más recientes. Cada registro muestra la hora de la entrega en la zona de la regla, o en la del navegador si la regla no especifica una, y la instrucción guardada. Si la conversación que recibió la entrega está disponible, un botón permite abrirla. Usa Expandir para leer una instrucción larga completa. Los registros que carecen de instrucción guardada nunca muestran la instrucción actual en su lugar. Cargar más añade la página siguiente. Los registros mantienen el orden de guardado, del más reciente al más antiguo, aunque el reloj retroceda. El resultado de la ejecución del modelo no forma parte del registro. Las teclas de flecha izquierda y derecha e Inicio y Fin cambian la pestaña que tiene el foco.

Si la vista de registros está vacía, la consulta se completó correctamente y no encontró registros guardados. La carga, una solicitud fallida, una tarea inexistente y un cursor inválido para registros anteriores tienen mensajes distintos. Usa Reintentar si falla la solicitud o no se encuentra la tarea, y Actualizar si el cursor es inválido para volver a cargar la página más reciente. Si falla una solicitud, es posible que los registros cargados sigan visibles junto con un aviso. Una nueva entrega actualiza la primera página. Las respuestas tardías de otra tarea o vista no reemplazan la vista actual.

Si la política de retención eliminó registros anteriores, la última página lo indica. Las reglas de retención muestran cuántos registros conserva cada tarea y durante cuántos días. Una tarea antigua que carece de historial guardado solo muestra su última entrega sin instrucción hasta que nuevas entregas añadan registros. Los registros anteriores y las copias de instrucciones que no se guardaron son irrecuperables.

El Host programa las tareas activas. Las pausadas y finalizadas no programan más entregas. Una tarea de una sola ejecución finaliza cuando se guarda el recordatorio de forma persistente en la bandeja de entrada de la conversación. Una tarea recurrente finaliza tras la última ejecución prevista por su regla. Para localizar tareas finalizadas, filtra por Todos o Finalizada. El reloj de la cabecera, la marca en la fila de sesión y la información al mantener el puntero solo muestran tareas activas. Para comprobar si se ha eliminado una tarea, consulta la lista de tareas.

En los detalles, Pausar detiene futuras entregas y Reanudar vuelve a activar una tarea pausada. Ejecutar ahora, en el menú de acciones, pide al Host que entregue la instrucción de inmediato una vez y conserva la próxima ejecución programada, incluso para tareas pausadas o finalizadas. Mientras una entrega a una conversación existente o a una única conversación nueva esté en cola o en curso, los campos y las acciones Guardar cambios, Pausar, Reanudar, Ejecutar ahora y Eliminar tarea quedan deshabilitados. Los detalles indican el estado y remiten a la conversación, que puedes abrir con el botón inferior. Si cada ejecución crea una conversación nueva, las ejecuciones pueden continuar en paralelo sin este bloqueo. Tras una entrega, Ejecutar ahora queda deshabilitado hasta que transcurra el intervalo mínimo. Si el intervalo es la única restricción, mantén el puntero sobre el botón o enfócalo con el teclado para ver cuándo estará disponible. Si el Host rechaza la ejecución, los detalles indican que la tarea está en cola, en curso o se acaba de entregar. Ejecutar ahora también queda deshabilitado si la conversación de destino está archivada. Si detienes la conversación mientras la instrucción está en cola, la instrucción espera hasta tu próximo mensaje, la próxima ejecución programada o una ejecución manual.

En el menú de acciones, selecciona Eliminar tarea y confirma para retirarla de la lista y cancelar las entregas futuras, aunque la tarea esté pausada o finalizada. También se eliminan sus registros de entrega. Tras confirmar, la aplicación muestra un aviso con el resultado. Si se elimina, el panel de detalles se cierra. Si falla, la tarea sigue disponible para reintentar. La eliminación conserva las conversaciones y los mensajes que ya están en cola. La fila sigue visible hasta que una consulta correcta confirma las tareas restantes. Si la consulta falla, usa Reintentar para volver a cargar el catálogo. Un error de consulta no confirma que la lista esté vacía.

<a id="edit-timing"></a>

<a id="edit-a-task"></a>

## Editar una tarea

Pide al modelo que cambie el nombre, la instrucción, la regla de repetición o el destino de entrega de un recordatorio, o que lo pause o reanude. El cambio conserva su ID y los registros de entrega guardados.

En las tareas de automatización, selecciona una tarea, aunque esté pausada o finalizada, para cambiar el nombre, la instrucción, el destino, el espacio de trabajo vinculado o el horario. Los cambios quedan en un borrador local hasta que pulses Guardar cambios. La edición conserva el ID, el último comprobante de entrega y todos los registros guardados. Cambiar la regla reactiva una tarea finalizada y mantiene pausada una tarea pausada. El destino de una tarea que entrega a una conversación existente muestra la conversación vinculada actual. Si eliges otra opción, las próximas ejecuciones crean sus conversaciones y el espacio de trabajo vinculado vuelve al valor inicial, como al crear una tarea manualmente. La tarea conserva su perfil predefinido mientras mantenga el mismo espacio de trabajo. Si cambias de espacio de trabajo, se usa el perfil predeterminado.

- Una vez. Fecha abre un calendario mensual y Hora abre las columnas Hora, Minuto y Segundo. La zona horaria se usa para interpretar la fecha y la hora. La tarea finaliza después de ejecutarse una vez.
- Cada N minutos y Cada N horas. Indica un intervalo de al menos un minuto o una hora, según la unidad. El intervalo se cuenta desde el minuto en que guardas la tarea.
- Todos los días. Intervalo indica el número de días. Hora abre las columnas Hora y Minuto.
- Semanal y De lunes a viernes. Intervalo indica el número de semanas y Día de la semana permite elegir los días. Hora abre las columnas Hora, Minuto y Segundo. De lunes a viernes selecciona los cinco días de una vez.
- Mensual. Intervalo indica el número de meses y Día del mes permite elegir del 1 al 31. Hora abre las columnas Hora, Minuto y Segundo. Si la fecha no existe en un mes, la tarea se ejecuta el último día de ese mes.
- Personalizado. Regla personalizada contiene el texto de la regla. Las reglas que las demás opciones no pueden reproducir se abren en Personalizado. Si una tarea existente no tiene un texto de regla editable, muestra su frecuencia original y conserva el horario hasta que guardes una regla nueva.

El selector de zona horaria muestra primero las zonas elegidas recientemente, marca la zona del sistema y permite buscar por desfase UTC, ID IANA o ciudad. Aparece en las opciones guiadas y en expresiones personalizadas que usan una zona aparte. En los demás casos, el texto de la regla personalizada indica la zona.

Los campos modifican solo el borrador local. Si el destino es una conversación existente, la sesión vinculada actual sigue disponible para deshacer un cambio de destino sin descartar otras ediciones. Mientras editas, el pie del panel indica que hay cambios sin guardar y muestra Descartar y Guardar cambios. Guardar cambios envía solo los campos modificados en una única actualización, y Descartar restaura los valores guardados. Solo se envía una regla nueva si ha cambiado el horario. Guardar cambios se habilita cuando hay un cambio efectivo y tanto los campos como el horario son válidos. Si el texto personalizado es inválido, el borrador se conserva y aparece un mensaje para corregirlo. El Host también valida la regla al guardar. Para pausar, reanudar, ejecutar ahora o eliminar, primero guarda o descarta el borrador. Los campos se deshabilitan al guardar. Cerrar los detalles no revierte una escritura que el Host ya haya empezado.

Cambiar de tarea o salir de la página conserva los borradores. Al actualizar el catálogo, un formulario sin cambios se actualiza y uno editado conserva todos sus campos y su versión original. Si una entrega u otra edición modifica la tarea, los detalles avisan y deshabilitan Guardar cambios cuando llega la versión más reciente. El Host también comprueba la versión al guardar. Revisar con mis cambios conserva los grupos que editaste entre el título, la instrucción, el horario y el destino, y carga los valores más recientes para los demás. Si otro cambio afectó al mismo grupo, prevalece tu edición en el formulario. Revisa el formulario completo antes de guardar. Esta acción solo prepara el formulario. Descartar sustituye todo el borrador por los últimos valores guardados. Si vuelve a fallar el guardado, el borrador se conserva y los detalles ofrecen reintentar. Antes de reintentar una actualización cuyo resultado se desconoce, comprueba la tarea. Una actualización aceptada vuelve a cargar el catálogo. Las respuestas tardías no reemplazan la vista actual después de cerrar los detalles o cambiar de tarea.

<a id="timing-and-delivery"></a>

<a id="timing-and-delivery-reference"></a>

## Referencia de horarios y entregas

Los recordatorios siguen guardados aunque se cierre la sesión. Mientras está en ejecución, el Host restaura o crea la sesión de destino cuando llega la hora y pone el mensaje de seguimiento en cola sin interrumpir el trabajo en curso. Al reiniciar, revisa las tareas guardadas y envía una tarea única vencida o solo la última entrega omitida de cada tarea recurrente. Al cerrar el Host se detiene la programación hasta que se inicie de nuevo. Las tareas recurrentes vencidas que tienen la misma sesión de destino pueden compartir un mensaje.

Una regla de repetición en una zona IANA sigue la hora local. Si una hora local no existe, la omite. Si una hora local se repite, usa el primero de los dos instantes. Las tareas existentes conservan su horario hasta que guardes una regla nueva. Un recordatorio de intervalo fijo sigue tomando como referencia su hora de creación. Un recordatorio diario, semanal o cron sigue las horas locales guardadas en su zona IANA. El navegador aporta su zona para interpretar peticiones en lenguaje natural. Especifica una zona para evitar ambigüedades. La página de tareas de automatización muestra la próxima ejecución en la zona del navegador. El texto de frecuencia indica la zona de la regla si difiere de la del navegador. Si la regla no indica ninguna zona, se usa la del navegador.

Un registro de entrega confirma que el mensaje se guardó en la bandeja de entrada de la conversación. El registro no indica si el modelo terminó el trabajo solicitado. Si falla la escritura en la bandeja de entrada o en la tarea, no se añade un registro. Si el proceso se interrumpe o falla la escritura de la tarea después de guardar el mensaje en la bandeja de entrada, la entrega puede quedar sin registrar y repetirse. El Host no garantiza una única entrega. Al cerrar el Host se descartan los mensajes que sigan en la bandeja de entrada de una conversación. El registro se conserva, pero el modelo no recibe ese mensaje y el Host no lo vuelve a enviar. Los registros sirven para consultar entregas. El historial de ejecución y las notificaciones externas quedan fuera de este mecanismo.

Al añadir un comprobante de entrega, el Host depura los registros guardados. Conserva como máximo los `deliveryHistoryRecords` registros más recientes cuya hora de confirmación esté dentro del intervalo `deliveryHistoryDays`, contado hacia atrás desde el `deliveredAt` del comprobante recién añadido. Siempre conserva el último comprobante e indica si los registros anteriores se han eliminado. El Host mantiene en memoria el historial conservado y reescribe toda la fila de la tarea con cada confirmación. La paginación limita el número de registros devueltos, sin limitar el historial conservado ni el tamaño de las instrucciones.

El modelo usa `schedule_edit` y la página de tareas de automatización ofrece los mismos controles para editar el nombre, la instrucción, el horario o el destino, pausar y reanudar cualquier recordatorio. Ambas opciones gestionan la tarea sin retransmitir trabajo entre sesiones. Cada cambio añade un aviso a la próxima solicitud al modelo de cada conversación involucrada cuyo agente esté cargado, salvo la que hizo el cambio. El Host no programa automáticamente recordatorios que solo consten en un registro de sesión antiguo. Vuelve a crear los que aún necesites. El Host no reconstruye los registros de las tareas eliminadas.

<a id="further-exploration"></a>
## Más información

- [Referencia de programación](../../../packages/schedule/schedule/README.md) documenta campos de tareas, destinos de entrega, reglas de recurrencia, persistencia y límites de entrega.
- [Referencia de la página de tareas de automatización](../../../packages/client/ui-schedule/README.md) describe la página global y el catálogo en la cabecera de la conversación.

<a id="dev-note"></a>

## Nota de desarrollo

Ninguna.
