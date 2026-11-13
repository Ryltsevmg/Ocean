/** Copy for the API Session-log upload preference. */
export const en = {
  title: 'Send session logs with DeepSeek API requests',
  description: 'Adds logged messages and tool results to requests sent by the DeepSeek adapter to its configured API address. Re-enabling can also send previously recorded logs.',
  saved: 'Preference saved',
  failed: 'Could not save preference',
}

/** Chinese preference copy. */
export const zh: Record<keyof typeof en, string> = {
  title: '随 DeepSeek API 请求发送会话日志',
  description: '将日志中的消息和工具结果添加到 DeepSeek 适配器发送至所配置 API 地址的请求中。重新启用也可能发送此前记录的日志。',
  saved: '设置已保存',
  failed: '无法保存设置',
}

/** Japanese copy, checked against the English keys. */
export const ja = {
  title: 'DeepSeek API リクエストとともにセッションログを送信',
  description: '記録されたメッセージとツール結果を、DeepSeek アダプターが設定済みの API アドレスに送るリクエストに追加します。再度有効にすると、過去のログも送信される場合があります。',
  'saved': '設定を保存しました',
  'failed': '設定を保存できませんでした',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  title: 'Enviar registros con las solicitudes a la API de DeepSeek',
  description: 'Añade mensajes y resultados de herramientas registrados a las solicitudes del adaptador DeepSeek a su dirección API configurada. Al reactivarlo también pueden enviarse registros anteriores.',
  saved: 'Preferencia guardada',
  failed: 'No se pudo guardar la preferencia',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  title: 'Envoyer les journaux avec les requêtes API DeepSeek',
  description: 'Ajoute les messages et résultats des outils aux requêtes de l’adaptateur DeepSeek vers son adresse API configurée. La réactivation peut aussi envoyer les journaux antérieurs.',
  saved: 'Préférence enregistrée',
  failed: "Impossible d'enregistrer la préférence",
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  title: 'Sitzungsprotokolle mit DeepSeek-API-Anfragen senden',
  description: 'Fügt protokollierte Nachrichten und Werkzeugergebnisse zu Anfragen des DeepSeek-Adapters an dessen konfigurierte API-Adresse hinzu. Erneutes Aktivieren kann auch frühere Protokolle senden.',
  saved: 'Präferenz gespeichert',
  failed: 'Präferenz konnte nicht gespeichert werden',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  title: 'Отправлять журнал с запросами API DeepSeek',
  description: 'Добавляет сообщения и результаты инструментов из журнала к запросам адаптера DeepSeek на настроенный API-адрес. Повторное включение может отправить и ранее накопленный журнал.',
  saved: 'Предпочтение сохранено.',
  failed: 'Не удалось сохранить предпочтения.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  title: 'Enviar registros com solicitações à API DeepSeek',
  description: 'Adiciona mensagens e resultados de ferramentas registrados às solicitações do adaptador DeepSeek ao endereço API configurado. Reativar também pode enviar registros anteriores.',
  saved: 'Preferência salva',
  failed: 'Não foi possível salvar a preferência',
} satisfies Record<keyof typeof en, string>
