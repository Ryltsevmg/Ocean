/** Public contact options shared by Host and Client. */
import z from '@deepseek-ai/schemastery'

/** Support destination shared by Host and Client. */
export interface ContactConfig {
  /** HTTPS support URL. */
  contactFormUrl: string
  /** Legacy configuration field, ignored when opening support. */
  contactSource: string
}
/** Validate public support options. */
export const ContactConfigFields = {
  contactFormUrl: z.string().pattern(/^https:\/\/[^/\s]+\//).default('https://t.me/oceanchatsupportbot'),
  contactSource: z.string().default(''),
}
/** Validate public support options. */
export const ContactConfig: z<Partial<ContactConfig>, ContactConfig> = z.object(ContactConfigFields)
/** Bootstrap key containing no account credentials. */
export const CONTACT_CONFIG_GLOBAL = '__DSH_CONTACT_CONFIG__'
