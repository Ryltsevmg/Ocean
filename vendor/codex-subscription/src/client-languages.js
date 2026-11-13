import { zh, en } from './client-locales.js'
import ja from './locales/ja.js'
import es from './locales/es.js'
import fr from './locales/fr.js'
import de from './locales/de.js'
import ru from './locales/ru.js'
import pt from './locales/pt.js'

// DSH owns the language catalog, persistence, reactive switching and fallbacks.
// Register dictionaries only; never add another language selector or preference.
const upstreamDictionaries = { zh, en, ja, es, fr, de, ru, pt }
const oceanNotices = {
  "en": "Ocean Codex includes sign-in, models and quota. Search, images, voice, remote control, connectors and runtime installation are unavailable in this build. Connecting uses OpenAI subscription services; this community integration is not endorsed by OpenAI.",
  "ru": "Ocean Codex: вход, модели и квоты. Поиск, изображения, голос, удалённое управление, коннекторы и установка runtime в этой сборке недоступны. Подключение использует сервисы подписки OpenAI; это независимая интеграция без одобрения OpenAI.",
  "zh": "Ocean Codex 提供登录、模型和配额。此版本不提供搜索、图像、语音、远程控制、连接器和运行时安装。连接使用 OpenAI 订阅服务；此社区集成未经 OpenAI 认可。",
  "ja": "Ocean Codex はログイン、モデル、利用枠に対応します。このビルドでは検索、画像、音声、リモート操作、コネクター、ランタイムのインストールは利用できません。OpenAI のサブスクリプションサービスを利用する非公式の連携です。",
  "es": "Ocean Codex incluye acceso, modelos y cuota. Esta versión no ofrece búsqueda, imágenes, voz, control remoto, conectores ni instalación del runtime. Usa servicios de suscripción de OpenAI; es una integración independiente no avalada por OpenAI.",
  "fr": "Ocean Codex inclut la connexion, les modèles et les quotas. Recherche, images, voix, contrôle à distance, connecteurs et installation du runtime ne sont pas disponibles dans cette version. Cette intégration indépendante utilise les services d’abonnement OpenAI sans être approuvée par OpenAI.",
  "de": "Ocean Codex bietet Anmeldung, Modelle und Kontingente. Suche, Bilder, Sprache, Fernsteuerung, Konnektoren und Runtime-Installation sind in dieser Version nicht verfügbar. Diese unabhängige Integration nutzt OpenAI-Abonnementdienste und ist nicht von OpenAI bestätigt.",
  "pt": "Ocean Codex inclui login, modelos e cota. Busca, imagens, voz, controle remoto, conectores e instalação do runtime não estão disponíveis nesta versão. Esta integração independente usa serviços de assinatura da OpenAI, sem aprovação da OpenAI."
}
const unifiedAuth = {
  en: { planTitle: 'ChatGPT', planDescription: 'Connect your account to use supported models in Ocean.', planLabel: 'Account label (optional)', planDefaultLabel: 'ChatGPT', planLoading: 'Checking connection…', planWaitingShort: 'Waiting for sign-in', planConnected: 'Connected', planDisconnected: 'Not connected', planAddAccount: 'Add another account', planModelsTitle: 'Available models', planModelsHint: 'Load your ChatGPT models on the Start tab, then choose one in a new conversation.', legacyConnectionTitle: 'Existing Codex connection', legacyConnectionHint: 'An independent legacy connection, retained for previous sessions and quota. Its credentials are not merged with the ChatGPT connection above.', legacyModelsTitle: 'Legacy Codex model settings' },
  ru: { planTitle: 'ChatGPT', planDescription: 'Подключите аккаунт для работы с поддерживаемыми моделями в Ocean.', planLabel: 'Название аккаунта (необязательно)', planDefaultLabel: 'ChatGPT', planLoading: 'Проверка подключения…', planWaitingShort: 'Ожидание входа', planConnected: 'Подключён', planDisconnected: 'Не подключён', planAddAccount: 'Добавить другой аккаунт', planModelsTitle: 'Доступные модели', planModelsHint: 'Загрузите модели ChatGPT на вкладке «Начало», затем выберите модель в новой беседе.', legacyConnectionTitle: 'Существующее подключение Codex', legacyConnectionHint: 'Отдельное прежнее подключение сохранено для старых сессий и квот. Его авторизация не объединяется с подключением ChatGPT выше.', legacyModelsTitle: 'Настройки моделей прежнего подключения Codex' },
}
export const dictionaries = Object.fromEntries(Object.entries(upstreamDictionaries).map(([language, dictionary]) => [language, { ...unifiedAuth.en, ...dictionary, ...unifiedAuth[language], title: 'Ocean Codex', nav: 'Ocean Codex', oceanScopeNotice: oceanNotices[language] }]))
