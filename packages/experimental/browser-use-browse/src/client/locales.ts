/** Browser setup labels deliberately distinguish configuration from connectivity. */
export const NS = 'oceanBrowserSetup'
/** English browser setup labels and safety notices. */
export const en = {
  title: 'Browser setup', summary: 'Configure a separately paired local browser',
  help: 'Install and pair trusted browse 0.0.16 separately. This form does not install extensions, grant permissions, start a relay or connect Chrome. Your browser profile shares existing logins.',
  enabled: 'Allow browser tools', enabledHelp: 'Tools become available after saving. Only a later explicit tool operation contacts the browser.',
  endpoint: 'Local relay address', tokenFile: 'Private token file path (not the token)', browser: 'Paired browser ID', origins: 'Allowed HTTPS origins, one per line',
  saved: 'Configuration saved. Connection not tested.', notTested: 'Browser connection: not tested', disabled: 'Browser tools are disabled', active: 'Browser tools are enabled; connection is still unverified',
  blocked: 'Browser cleanup could not be confirmed. Restart Ocean before changing settings. Inspect remaining browser tabs separately.',
  readOnly: 'This profile cannot be edited here.', loading: 'Reading configuration…', save: 'Review changes', saving: 'Saving…', refresh: 'Reload saved configuration',
  confirm: 'Save these settings?', consequences: 'This stops existing Ocean browser sessions before applying the new browser and allowed sites. Already sent actions cannot be undone. Enabling tools does not pair or test Chrome.',
  confirmSave: 'Save and apply', cancel: 'Cancel', readError: 'Configuration could not be read. No changes were sent.', saveError: 'Save was not confirmed. Reload configuration before trying again; do not assume previous browser work was canceled.',
} as const
/** Keys required by every browser setup translation. */
export type SetupLocaleKey = keyof typeof en
/** Russian browser setup labels and safety notices. */
export const ru: Record<SetupLocaleKey, string> = {
  title: 'Настройка браузера', summary: 'Подключение отдельно сопряжённого локального браузера',
  help: 'Установите и сопрягите доверенный browse 0.0.16 отдельно. Эта форма не устанавливает расширения, не выдаёт разрешения, не запускает relay и не подключает Chrome. Профиль браузера сохраняет ваши существующие входы.',
  enabled: 'Разрешить инструменты браузера', enabledHelp: 'После сохранения появятся инструменты. Обращение к браузеру произойдёт только при последующей явно запрошенной операции.',
  endpoint: 'Локальный адрес relay', tokenFile: 'Путь к приватному файлу токена (не сам токен)', browser: 'ID сопряжённого браузера', origins: 'Разрешённые HTTPS-источники, по одному в строке',
  saved: 'Настройки сохранены. Соединение не проверено.', notTested: 'Соединение с браузером: не проверено', disabled: 'Инструменты браузера выключены', active: 'Инструменты браузера включены; соединение ещё не проверено',
  blocked: 'Завершение работы браузера не подтверждено. Перезапустите Ocean перед изменением настроек. Оставшиеся вкладки проверьте отдельно.',
  readOnly: 'Этот профиль нельзя изменить здесь.', loading: 'Читаю настройки…', save: 'Проверить изменения', saving: 'Сохраняю…', refresh: 'Загрузить сохранённые настройки',
  confirm: 'Сохранить эти настройки?', consequences: 'Текущие браузерные сессии Ocean будут остановлены перед применением нового браузера и списка сайтов. Уже отправленные действия нельзя отменить. Включение инструментов не сопрягает и не проверяет Chrome.',
  confirmSave: 'Сохранить и применить', cancel: 'Отмена', readError: 'Не удалось прочитать настройки. Изменения не отправлялись.', saveError: 'Сохранение не подтверждено. Загрузите настройки перед повторной попыткой; не считайте предыдущую работу браузера отменённой.',
}
/** Chinese browser setup labels and safety notices. */
export const zh: Record<SetupLocaleKey, string> = {
  title: '浏览器设置', summary: '配置已单独配对的本地浏览器',
  help: '请单独安装并配对可信的 browse 0.0.16。此表单不会安装扩展、授予权限、启动中继或连接 Chrome。浏览器配置文件会共享已有的登录状态。',
  enabled: '允许浏览器工具', enabledHelp: '保存后工具才会可用。只有后续明确执行工具操作时才会联系浏览器。',
  endpoint: '本地中继地址', tokenFile: '私有令牌文件路径（不是令牌本身）', browser: '已配对的浏览器 ID', origins: '允许的 HTTPS 来源，每行一个',
  saved: '配置已保存。尚未测试连接。', notTested: '浏览器连接：尚未测试', disabled: '浏览器工具已禁用', active: '浏览器工具已启用；连接仍未经验证',
  blocked: '无法确认浏览器清理是否完成。更改设置前请重启 Ocean。请另外检查剩余的浏览器标签页。',
  readOnly: '无法在此处编辑此配置文件。', loading: '正在读取配置…', save: '检查更改', saving: '正在保存…', refresh: '重新加载已保存的配置',
  confirm: '保存这些设置？', consequences: '在应用新的浏览器和允许的网站之前，这会停止现有的 Ocean 浏览器会话。已发送的操作无法撤销。启用工具不会配对或测试 Chrome。',
  confirmSave: '保存并应用', cancel: '取消', readError: '无法读取配置。未发送任何更改。', saveError: '保存未获确认。重试前请重新加载配置；不要假定先前的浏览器工作已取消。',
}
/** Japanese browser setup labels and safety notices. */
export const ja: Record<SetupLocaleKey, string> = {
  title: 'ブラウザー設定', summary: '別途ペアリングしたローカルブラウザーを設定',
  help: '信頼できる browse 0.0.16 を別途インストールし、ペアリングしてください。このフォームは拡張機能のインストール、権限の付与、リレーの起動、Chrome への接続を行いません。ブラウザープロファイルの既存のログイン状態が共有されます。',
  enabled: 'ブラウザーツールを許可', enabledHelp: '保存後にツールが利用可能になります。ブラウザーへの通信は、その後に明示的なツール操作を行った場合にのみ発生します。',
  endpoint: 'ローカルリレーのアドレス', tokenFile: '非公開トークンファイルのパス（トークン自体ではありません）', browser: 'ペアリング済みブラウザーの ID', origins: '許可する HTTPS オリジン（1 行に 1 件）',
  saved: '設定を保存しました。接続は未テストです。', notTested: 'ブラウザー接続：未テスト', disabled: 'ブラウザーツールは無効です', active: 'ブラウザーツールは有効ですが、接続は未確認です',
  blocked: 'ブラウザーのクリーンアップ完了を確認できませんでした。設定を変更する前に Ocean を再起動してください。残っているブラウザータブは別途確認してください。',
  readOnly: 'このプロファイルはここでは編集できません。', loading: '設定を読み込み中…', save: '変更を確認', saving: '保存中…', refresh: '保存済み設定を再読み込み',
  confirm: 'この設定を保存しますか？', consequences: '新しいブラウザーと許可サイトを適用する前に、既存の Ocean ブラウザーセッションを停止します。送信済みの操作は取り消せません。ツールを有効にしても Chrome のペアリングやテストは行われません。',
  confirmSave: '保存して適用', cancel: 'キャンセル', readError: '設定を読み込めませんでした。変更は送信されていません。', saveError: '保存を確認できませんでした。再試行する前に設定を再読み込みしてください。以前のブラウザー作業がキャンセルされたとは限りません。',
}
/** Spanish browser setup labels and safety notices. */
export const es: Record<SetupLocaleKey, string> = {
  title: 'Configuración del navegador', summary: 'Configurar un navegador local emparejado por separado',
  help: 'Instala y empareja por separado una copia de confianza de browse 0.0.16. Este formulario no instala extensiones, concede permisos, inicia un relay ni conecta Chrome. El perfil del navegador comparte las sesiones iniciadas existentes.',
  enabled: 'Permitir herramientas del navegador', enabledHelp: 'Las herramientas estarán disponibles después de guardar. Solo una operación explícita posterior de una herramienta contactará con el navegador.',
  endpoint: 'Dirección del relay local', tokenFile: 'Ruta del archivo privado del token (no el token)', browser: 'ID del navegador emparejado', origins: 'Orígenes HTTPS permitidos, uno por línea',
  saved: 'Configuración guardada. Conexión no probada.', notTested: 'Conexión del navegador: no probada', disabled: 'Las herramientas del navegador están desactivadas', active: 'Las herramientas del navegador están activadas; la conexión sigue sin verificarse',
  blocked: 'No se pudo confirmar la limpieza del navegador. Reinicia Ocean antes de cambiar los ajustes. Revisa por separado las pestañas restantes.',
  readOnly: 'Este perfil no se puede editar aquí.', loading: 'Leyendo configuración…', save: 'Revisar cambios', saving: 'Guardando…', refresh: 'Recargar configuración guardada',
  confirm: '¿Guardar estos ajustes?', consequences: 'Esto detiene las sesiones de navegador existentes de Ocean antes de aplicar el nuevo navegador y los sitios permitidos. Las acciones ya enviadas no se pueden deshacer. Activar las herramientas no empareja ni prueba Chrome.',
  confirmSave: 'Guardar y aplicar', cancel: 'Cancelar', readError: 'No se pudo leer la configuración. No se enviaron cambios.', saveError: 'No se confirmó el guardado. Recarga la configuración antes de volver a intentarlo; no des por hecho que el trabajo anterior del navegador se haya cancelado.',
}
/** French browser setup labels and safety notices. */
export const fr: Record<SetupLocaleKey, string> = {
  title: 'Configuration du navigateur', summary: 'Configurer un navigateur local associé séparément',
  help: 'Installez et associez séparément une copie de confiance de browse 0.0.16. Ce formulaire n’installe pas d’extensions, n’accorde pas d’autorisations, ne démarre pas de relais et ne connecte pas Chrome. Le profil du navigateur partage les connexions aux comptes déjà établies.',
  enabled: 'Autoriser les outils du navigateur', enabledHelp: 'Les outils seront disponibles après l’enregistrement. Seule une opération explicite ultérieure d’un outil contactera le navigateur.',
  endpoint: 'Adresse du relais local', tokenFile: 'Chemin du fichier privé du jeton (pas le jeton)', browser: 'ID du navigateur associé', origins: 'Origines HTTPS autorisées, une par ligne',
  saved: 'Configuration enregistrée. Connexion non testée.', notTested: 'Connexion au navigateur : non testée', disabled: 'Les outils du navigateur sont désactivés', active: 'Les outils du navigateur sont activés ; la connexion reste non vérifiée',
  blocked: 'Le nettoyage du navigateur n’a pas pu être confirmé. Redémarrez Ocean avant de modifier les paramètres. Vérifiez séparément les onglets restants.',
  readOnly: 'Ce profil ne peut pas être modifié ici.', loading: 'Lecture de la configuration…', save: 'Vérifier les modifications', saving: 'Enregistrement…', refresh: 'Recharger la configuration enregistrée',
  confirm: 'Enregistrer ces paramètres ?', consequences: 'Cela arrête les sessions de navigateur Ocean existantes avant d’appliquer le nouveau navigateur et les sites autorisés. Les actions déjà envoyées ne peuvent pas être annulées. Activer les outils n’associe pas Chrome et ne le teste pas.',
  confirmSave: 'Enregistrer et appliquer', cancel: 'Annuler', readError: 'Impossible de lire la configuration. Aucune modification n’a été envoyée.', saveError: 'L’enregistrement n’a pas été confirmé. Rechargez la configuration avant de réessayer ; ne supposez pas que le travail précédent du navigateur a été annulé.',
}
/** German browser setup labels and safety notices. */
export const de: Record<SetupLocaleKey, string> = {
  title: 'Browser-Einrichtung', summary: 'Einen separat gekoppelten lokalen Browser konfigurieren',
  help: 'Installiere und kopple eine vertrauenswürdige Version von browse 0.0.16 separat. Dieses Formular installiert keine Erweiterungen, erteilt keine Berechtigungen, startet kein Relay und verbindet Chrome nicht. Das Browserprofil teilt bestehende Anmeldungen.',
  enabled: 'Browserwerkzeuge erlauben', enabledHelp: 'Die Werkzeuge sind nach dem Speichern verfügbar. Erst ein späterer ausdrücklicher Werkzeugaufruf kontaktiert den Browser.',
  endpoint: 'Lokale Relay-Adresse', tokenFile: 'Pfad zur privaten Token-Datei (nicht das Token)', browser: 'ID des gekoppelten Browsers', origins: 'Erlaubte HTTPS-Ursprünge, einer pro Zeile',
  saved: 'Konfiguration gespeichert. Verbindung nicht getestet.', notTested: 'Browserverbindung: nicht getestet', disabled: 'Browserwerkzeuge sind deaktiviert', active: 'Browserwerkzeuge sind aktiviert; die Verbindung ist weiterhin ungeprüft',
  blocked: 'Die Browserbereinigung konnte nicht bestätigt werden. Starte Ocean neu, bevor du Einstellungen änderst. Prüfe verbleibende Browsertabs separat.',
  readOnly: 'Dieses Profil kann hier nicht bearbeitet werden.', loading: 'Konfiguration wird gelesen…', save: 'Änderungen prüfen', saving: 'Wird gespeichert…', refresh: 'Gespeicherte Konfiguration neu laden',
  confirm: 'Diese Einstellungen speichern?', consequences: 'Dadurch werden bestehende Ocean-Browsersitzungen beendet, bevor der neue Browser und die erlaubten Websites übernommen werden. Bereits gesendete Aktionen lassen sich nicht rückgängig machen. Das Aktivieren der Werkzeuge koppelt oder testet Chrome nicht.',
  confirmSave: 'Speichern und übernehmen', cancel: 'Abbrechen', readError: 'Die Konfiguration konnte nicht gelesen werden. Es wurden keine Änderungen gesendet.', saveError: 'Das Speichern wurde nicht bestätigt. Lade die Konfiguration vor einem erneuten Versuch neu; gehe nicht davon aus, dass frühere Browserarbeit abgebrochen wurde.',
}
/** Portuguese browser setup labels and safety notices. */
export const pt: Record<SetupLocaleKey, string> = {
  title: 'Configuração do navegador', summary: 'Configurar um navegador local emparelhado separadamente',
  help: 'Instale e emparelhe separadamente uma cópia confiável do browse 0.0.16. Este formulário não instala extensões, concede permissões, inicia um relay nem conecta o Chrome. O perfil do navegador compartilha os logins existentes.',
  enabled: 'Permitir ferramentas do navegador', enabledHelp: 'As ferramentas ficam disponíveis após salvar. Somente uma operação explícita posterior de uma ferramenta acessará o navegador.',
  endpoint: 'Endereço do relay local', tokenFile: 'Caminho do arquivo privado do token (não o token)', browser: 'ID do navegador emparelhado', origins: 'Origens HTTPS permitidas, uma por linha',
  saved: 'Configuração salva. Conexão não testada.', notTested: 'Conexão com o navegador: não testada', disabled: 'As ferramentas do navegador estão desativadas', active: 'As ferramentas do navegador estão ativadas; a conexão continua sem verificação',
  blocked: 'Não foi possível confirmar a limpeza do navegador. Reinicie o Ocean antes de alterar as configurações. Verifique separadamente as abas restantes.',
  readOnly: 'Este perfil não pode ser editado aqui.', loading: 'Lendo configuração…', save: 'Revisar alterações', saving: 'Salvando…', refresh: 'Recarregar configuração salva',
  confirm: 'Salvar estas configurações?', consequences: 'Isso encerra as sessões de navegador existentes do Ocean antes de aplicar o novo navegador e os sites permitidos. Ações já enviadas não podem ser desfeitas. Ativar as ferramentas não emparelha nem testa o Chrome.',
  confirmSave: 'Salvar e aplicar', cancel: 'Cancelar', readError: 'Não foi possível ler a configuração. Nenhuma alteração foi enviada.', saveError: 'O salvamento não foi confirmado. Recarregue a configuração antes de tentar novamente; não presuma que o trabalho anterior do navegador foi cancelado.',
}
