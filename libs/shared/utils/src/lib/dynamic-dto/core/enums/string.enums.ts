export const StringFormat = {
  // Basic formats
  email: 'email',
  url: 'url',
  uuid: 'uuid',

  // Date/Time
  date: 'date',
  time: 'time',
  datetime: 'datetime',

  // Communication
  phone: 'phone',
  mobile: 'mobile',

  // Network
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  mac_address: 'mac_address',
  domain: 'domain',

  // Identity
  username: 'username',
  password: 'password',

  // Data formats
  json: 'json',
  xml: 'xml',
  base64: 'base64',
  hex: 'hex',

  // Financial
  currency: 'currency',
  credit_card: 'credit_card',

  // Geographic
  country_code: 'country_code',
  postal_code: 'postal_code',
  coordinate: 'coordinate',

  // Technical
  semver: 'semver',
  cron: 'cron',

  // Markup
  html: 'html',
} as const;

export type StringFormat = (typeof StringFormat)[keyof typeof StringFormat];
