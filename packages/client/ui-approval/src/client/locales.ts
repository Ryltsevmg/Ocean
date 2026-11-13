/** `approval` namespace dictionaries. */

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  submitting: '正在提交决定',
  waiting: '等待审批',
  'detail.aria': '审批详情',
  escalation: '工具 {toolName} 请求越权执行',
  reject: '拒绝',
  allow: '允许',
  allowOnce: '允许一次',
  allowAlways: '始终允许',
} satisfies Record<string, string>

/** Approval dictionary key union. */
export type ApprovalKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  submitting: 'Submitting decision',
  waiting: 'Waiting for approval',
  'detail.aria': 'Approval details',
  escalation: 'Tool {toolName} requests privileged execution',
  reject: 'Reject',
  allow: 'Allow',
  allowOnce: 'Allow once',
  allowAlways: 'Always allow',
} satisfies Record<ApprovalKey, string>

/** Japanese copy, checked against the English keys. */
export const ja = {
  submitting: '決定を送信中',
  'waiting': '承認待ち',
  'detail.aria': '承認の詳細',
  'escalation': 'ツール{toolName}が通常より高い権限での実行を要求しています',
  'reject': '拒否',
  'allow': '許可',
  'allowOnce': '今回のみ許可',
  'allowAlways': '常に許可',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  submitting: 'Enviando decisión',
  waiting: 'Esperando aprobación',
  'detail.aria': 'Detalles de la aprobación',
  escalation: 'La herramienta {toolName} solicita ejecutarse con privilegios elevados',
  reject: 'Rechazar',
  allow: 'Permitir',
  allowOnce: 'Permitir una sola vez',
  allowAlways: 'Permitir siempre',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  submitting: 'Envoi de la décision',
  waiting: 'En attente d’approbation',
  'detail.aria': 'Détails de l’approbation',
  escalation: 'L’outil {toolName} demande une exécution privilégiée',
  reject: 'Rejeter',
  allow: 'Autoriser',
  allowOnce: 'Autoriser une seule fois',
  allowAlways: 'Toujours autoriser',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  submitting: 'Entscheidung wird gesendet',
  waiting: 'Warten auf Freigabe',
  'detail.aria': 'Freigabedetails',
  escalation: 'Tool {toolName} fordert eine privilegierte Ausführung an',
  reject: 'Ablehnen',
  allow: 'Erlauben',
  allowOnce: 'Einmal erlauben',
  allowAlways: 'Immer zulassen',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  submitting: 'Отправка решения',
  waiting: 'Ожидание подтверждения',
  'detail.aria': 'Сведения о подтверждении',
  escalation: 'Инструмент {toolName} запрашивает выполнение с расширенными правами',
  reject: 'Отклонить',
  allow: 'Разрешить',
  allowOnce: 'Разрешить один раз',
  allowAlways: 'Всегда разрешать',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  submitting: 'Enviando decisão',
  waiting: 'Aguardando aprovação',
  'detail.aria': 'Detalhes da aprovação',
  escalation: 'A ferramenta {toolName} solicita execução privilegiada',
  reject: 'Rejeitar',
  allow: 'Permitir',
  allowOnce: 'Permitir uma vez',
  allowAlways: 'Sempre permitir',
} satisfies Record<keyof typeof en, string>
