// Valores por omissão, iguais às definições atuais do WordPress (rtcl_moderation_settings).
export const SETTINGS_DEFAULTS = {
  "listings.moderation": true, // novos anúncios ficam pendentes
  "listings.moderateEdits": true, // anúncios editados voltam a pendente
  "listings.durationDays": 120,
  "listings.expiryWarningDays": 3,
  "listings.reminderAfterDays": 3,
  "listings.deleteExpiredAfterDays": 365,
  "listings.maxImages": 9,
  "listings.maxImageMb": 3,
  "listings.titleMax": 45,
  "listings.descriptionMax": 2000,
  "listings.freeAdsPerUser": 10,
  "listings.newLabelDays": 15,
  "listings.popularViews": 100,
  "listings.perPage": 9,
  "email.fromName": "Portal do Trespasse",
  "email.adminRecipients": [] as string[],
  "site.notice": "",
} as const;

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;
