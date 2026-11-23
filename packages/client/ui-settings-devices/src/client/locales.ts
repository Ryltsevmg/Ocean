/** Copy for the Devices settings section. */

/** Locale keys the section renders. */
export type DevicesLocaleKey =
  | 'title' | 'intro' | 'loading' | 'empty' | 'loadFailed' | 'retry' | 'unmanaged'
  | 'active' | 'revoked' | 'revoke' | 'confirm' | 'cancel' | 'revoking' | 'revokeFailed'
  | 'rights' | 'allRights'

/** English copy. */
export const en: Record<DevicesLocaleKey, string> = {
  title: 'Devices',
  intro: 'Devices signed in to this Host. Revoking one closes its connections and refuses its next sign-in.',
  loading: 'Loading devices…',
  empty: 'No device is signed in to this Host yet.',
  loadFailed: 'Devices could not be loaded. Check the connection to this Host, then retry.',
  unmanaged: 'This Host does not manage devices, so it has no device list. Device access is enabled only for a Host started with device authentication.',
  retry: 'Retry',
  active: 'Active',
  revoked: 'Revoked',
  revoke: 'Revoke',
  confirm: 'Confirm',
  cancel: 'Cancel',
  revoking: 'Revoking…',
  revokeFailed: 'This device was not revoked. Retry, or check the connection to this Host.',
  rights: 'Rights',
  allRights: 'All rights',
}

/** Simplified Chinese copy. */
export const zh: Record<DevicesLocaleKey, string> = {
  title: '设备',
  intro: '已登录此 Host 的设备。吊销一台会断开它的连接，并拒绝它下次登录。',
  loading: '正在加载设备…',
  empty: '还没有设备登录此 Host。',
  loadFailed: '无法加载设备。请检查与此 Host 的连接，然后重试。',
  unmanaged: '此 Host 不管理设备，因此没有设备列表。只有在启用设备认证的情况下启动的 Host 才会启用设备访问。',
  retry: '重试',
  active: '活动',
  revoked: '已吊销',
  revoke: '吊销',
  confirm: '确认',
  cancel: '取消',
  revoking: '正在吊销…',
  revokeFailed: '该设备没有被吊销。请重试，或检查与此 Host 的连接。',
  rights: '权限',
  allRights: '全部权限',
}

/** Japanese copy, checked against the English keys. */
export const ja = {
  title: 'デバイス',
  intro: 'このホストにサインインしているデバイスです。1 台を取り消すと、その接続が閉じられ、次回のサインインが拒否されます。',
  loading: 'デバイスを読み込み中…',
  empty: 'このホストにサインインしているデバイスはまだありません。',
  loadFailed: 'デバイスを読み込めませんでした。このホストへの接続を確認してから再試行してください。',
  unmanaged: 'このホストはデバイスを管理していないため、デバイス一覧はありません。デバイス認証を有効にして起動したホストでのみ、デバイスアクセスが有効になります。',
  retry: '再試行',
  active: '有効',
  revoked: '取り消し済み',
  revoke: '取り消す',
  confirm: '確定',
  cancel: 'キャンセル',
  revoking: '取り消し中…',
  revokeFailed: 'このデバイスは取り消されませんでした。再試行するか、このホストへの接続を確認してください。',
  rights: '権限',
  allRights: 'すべての権限',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  title: 'Dispositivos',
  intro: 'Dispositivos con sesión iniciada en este Host. Revocar uno cierra sus conexiones y rechaza su próximo inicio de sesión.',
  loading: 'Cargando dispositivos…',
  empty: 'Todavía no hay ningún dispositivo con sesión iniciada en este Host.',
  loadFailed: 'No se pudieron cargar los dispositivos. Compruebe la conexión con este Host y vuelva a intentarlo.',
  unmanaged: 'Este Host no gestiona dispositivos, así que no tiene lista de dispositivos. El acceso por dispositivo solo se habilita en un Host iniciado con autenticación de dispositivos.',
  retry: 'Reintentar',
  active: 'Activo',
  revoked: 'Revocado',
  revoke: 'Revocar',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  revoking: 'Revocando…',
  revokeFailed: 'Este dispositivo no se revocó. Vuelva a intentarlo o compruebe la conexión con este Host.',
  rights: 'Permisos',
  allRights: 'Todos los permisos',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  title: 'Appareils',
  intro: 'Appareils connectés à ce Host. En révoquer un ferme ses connexions et refuse sa prochaine connexion.',
  loading: 'Chargement des appareils…',
  empty: "Aucun appareil n'est encore connecté à ce Host.",
  loadFailed: 'Les appareils n’ont pas pu être chargés. Vérifiez la connexion à ce Host, puis réessayez.',
  unmanaged: 'Ce Host ne gère pas d’appareils : il n’a donc pas de liste. L’accès par appareil n’est activé que pour un Host démarré avec l’authentification par appareil.',
  retry: 'Réessayer',
  active: 'Actif',
  revoked: 'Révoqué',
  revoke: 'Révoquer',
  confirm: 'Confirmer',
  cancel: 'Annuler',
  revoking: 'Révocation…',
  revokeFailed: "Cet appareil n'a pas été révoqué. Réessayez ou vérifiez la connexion à ce Host.",
  rights: 'Droits',
  allRights: 'Tous les droits',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  title: 'Geräte',
  intro: 'Bei diesem Host angemeldete Geräte. Das Widerrufen eines Geräts schließt seine Verbindungen und verweigert die nächste Anmeldung.',
  loading: 'Geräte werden geladen…',
  empty: 'Bei diesem Host ist noch kein Gerät angemeldet.',
  loadFailed: 'Die Geräte konnten nicht geladen werden. Prüfen Sie die Verbindung zu diesem Host und versuchen Sie es erneut.',
  unmanaged: 'Dieser Host verwaltet keine Geräte und hat deshalb keine Geräteliste. Gerätezugriff gibt es nur für einen Host, der mit Geräteauthentifizierung gestartet wurde.',
  retry: 'Erneut versuchen',
  active: 'Aktiv',
  revoked: 'Widerrufen',
  revoke: 'Widerrufen',
  confirm: 'Bestätigen',
  cancel: 'Abbrechen',
  revoking: 'Widerruf läuft…',
  revokeFailed: 'Dieses Gerät wurde nicht widerrufen. Versuchen Sie es erneut oder prüfen Sie die Verbindung zu diesem Host.',
  rights: 'Rechte',
  allRights: 'Alle Rechte',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  title: 'Устройства',
  intro: 'Устройства, вошедшие на этот Host. Отзыв закрывает подключения устройства и отклоняет следующий вход.',
  loading: 'Загрузка устройств…',
  empty: 'На этот Host ещё не входило ни одно устройство.',
  loadFailed: 'Не удалось загрузить устройства. Проверьте подключение к этому Host и повторите попытку.',
  unmanaged: 'Этот Host не управляет устройствами, поэтому списка устройств нет. Доступ по устройствам есть только у Host, запущенного с аутентификацией устройств.',
  retry: 'Повторить',
  active: 'Активно',
  revoked: 'Отозвано',
  revoke: 'Отозвать',
  confirm: 'Подтвердить',
  cancel: 'Отмена',
  revoking: 'Отзываем…',
  revokeFailed: 'Устройство не отозвано. Повторите попытку или проверьте подключение к этому Host.',
  rights: 'Права',
  allRights: 'Все права',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  title: 'Dispositivos',
  intro: 'Dispositivos com sessão iniciada neste Host. Revogar um fecha as suas ligações e recusa a próxima entrada.',
  loading: 'A carregar dispositivos…',
  empty: 'Ainda nenhum dispositivo iniciou sessão neste Host.',
  loadFailed: 'Não foi possível carregar os dispositivos. Verifique a ligação a este Host e tente novamente.',
  unmanaged: 'Este Host não gere dispositivos, por isso não tem lista de dispositivos. O acesso por dispositivo só é ativado num Host iniciado com autenticação de dispositivos.',
  retry: 'Tentar novamente',
  active: 'Ativo',
  revoked: 'Revogado',
  revoke: 'Revogar',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  revoking: 'A revogar…',
  revokeFailed: 'Este dispositivo não foi revogado. Tente novamente ou verifique a ligação a este Host.',
  rights: 'Permissões',
  allRights: 'Todas as permissões',
} satisfies Record<keyof typeof en, string>

/** Korean dictionary, checked against the English keys. */
export const ko = {
  title: '기기',
  intro: '이 Host에 로그인한 기기입니다. 하나를 취소하면 해당 연결이 닫히고 다음 로그인이 거부됩니다.',
  loading: '기기를 불러오는 중…',
  empty: '아직 이 Host에 로그인한 기기가 없습니다.',
  loadFailed: '기기를 불러오지 못했습니다. 이 Host와의 연결을 확인한 뒤 다시 시도하세요.',
  unmanaged: '이 Host는 기기를 관리하지 않으므로 기기 목록이 없습니다. 기기 액세스는 기기 인증으로 시작된 Host에서만 사용할 수 있습니다.',
  retry: '다시 시도',
  active: '활성',
  revoked: '취소됨',
  revoke: '취소',
  confirm: '확인',
  cancel: '취소',
  revoking: '취소 중…',
  revokeFailed: '이 기기는 취소되지 않았습니다. 다시 시도하거나 이 Host와의 연결을 확인하세요.',
  rights: '권한',
  allRights: '모든 권한',
} satisfies Record<keyof typeof en, string>
