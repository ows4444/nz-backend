import type { StringFormat } from '../../../../core/enums/string.enums';
import type { FieldType } from '../../../types/field.types';
import type { BaseFieldSchema } from '../base/base-field.schema';

export interface StringFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.string;
  readonly default?: string | StringDefaultValue;

  // Length constraints
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly exactLength?: number;

  // Pattern validation
  readonly pattern?: string | RegExp;
  readonly antiPattern?: string | RegExp;
  readonly format?: StringFormat;
  readonly formatOptions?: StringFormatOptions;

  // Generation
  readonly autoGenerate?: AutoGenerationType;
  readonly autoGenerateConfig?: AutoGenerateConfig;

  // Transformations
  readonly caseTransform?: CaseTransform;
  readonly trimming?: TrimOptions;

  // Content validation
  readonly allowedCharacters?: CharacterSet;
  readonly forbiddenCharacters?: CharacterSet;
  readonly contentRules?: readonly ContentRule[];

  readonly security?: SecurityConfig;
  readonly indexing?: IndexingConfig;
}

export interface StringDefaultValue {
  readonly type: 'static' | 'dynamic' | 'computed' | 'template';
  readonly value?: string;
  readonly template?: string;
  readonly expression?: string;
  readonly context?: readonly string[];
}

export interface StringFormatOptions {
  readonly strict?: boolean;
  readonly allowPartial?: boolean;
  readonly locale?: string;
  readonly customValidator?: string;
}

export const AutoGenerationType = {
  uuid: 'uuid',
  ulid: 'ulid',
  nanoid: 'nanoid',
  timestamp: 'timestamp',
  incremental: 'incremental',
  slug: 'slug',
  hash: 'hash',
  random_string: 'random_string',
  sequence: 'sequence',
} as const;

export type AutoGenerationType = (typeof AutoGenerationType)[keyof typeof AutoGenerationType];

export interface AutoGenerateConfig {
  readonly prefix?: string;
  readonly suffix?: string;
  readonly length?: number;
  readonly charset?: string;
  readonly template?: string;
  readonly counter?: CounterConfig;
}

export interface CounterConfig {
  readonly start: number;
  readonly step: number;
  readonly padLength?: number;
  readonly resetOn?: 'daily' | 'monthly' | 'yearly';
}

export interface TrimOptions {
  start?: boolean;
  end?: boolean;
  inner?: boolean; // Trim inner whitespace
  chars?: string; // Custom characters to trim
  preserve?: string[]; // Characters to preserve
}

export enum CaseTransform {
  NONE = 'none',
  LOWER = 'lower',
  UPPER = 'upper',
  TITLE = 'title',
  SENTENCE = 'sentence',
  CAMEL = 'camel',
  PASCAL = 'pascal',
  SNAKE = 'snake',
  KEBAB = 'kebab',
  CONSTANT = 'constant',
  DOT = 'dot',
  PATH = 'path',
  HEADER = 'header',
  ALTERNATING = 'alternating',
  INVERSE = 'inverse',
  CAPITALIZE_FIRST = 'capitalize_first',
  CAPITALIZE_WORDS = 'capitalize_words',
}

export interface NormalizeOptions {
  form?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  caseFold?: boolean;
  stripAccents?: boolean;
  stripPunctuation?: boolean;
  compactWhitespace?: boolean;
  removeEmptyLines?: boolean;
}

export enum CharacterSet {
  ALPHA = 'alpha',
  NUMERIC = 'numeric',
  ALPHANUMERIC = 'alphanumeric',
  ASCII = 'ascii',
  UNICODE = 'unicode',
  PRINTABLE = 'printable',
  WHITESPACE = 'whitespace',
  PUNCTUATION = 'punctuation',
  SPECIAL = 'special',
  EMOJI = 'emoji',
  ACCENTED = 'accented',
  CJK = 'cjk',
  ARABIC = 'arabic',
  HEBREW = 'hebrew',
  CYRILLIC = 'cyrillic',
  GREEK = 'greek',
  THAI = 'thai',
  DEVANAGARI = 'devanagari',
}

export interface ContentRule {
  type: 'profanity' | 'spam' | 'adult' | 'violence' | 'custom';
  action: 'block' | 'warn' | 'filter' | 'replace';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  replacement?: string;
  customRules?: string[];
  whitelist?: string[];
  blacklist?: string[];
}

export interface SecurityConfig {
  encryption?: EncryptionConfig;
  hashing?: HashingConfig;
  redaction?: RedactionConfig;
  pii?: boolean; // Personally Identifiable Information
  sensitive?: boolean;
}

export interface EncryptionConfig {
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyId?: string;
  searchable?: boolean; // Searchable encryption
}

export interface HashingConfig {
  algorithm?: 'sha256' | 'sha512' | 'bcrypt' | 'argon2' | 'scrypt';
  salt?: boolean;
  rounds?: number;
  pepper?: boolean;
}

export interface RedactionConfig {
  mode?: 'mask' | 'hash' | 'remove' | 'tokenize';
  preserveLength?: boolean;
  maskChar?: string;
  preserveFormat?: boolean;
  exceptions?: string[]; // Parts not to redact
}

export interface IndexingConfig {
  type?: 'btree' | 'hash' | 'gin' | 'gist' | 'fulltext';
  unique?: boolean;
  sparse?: boolean;
  partial?: string;
  collation?: string;
  compression?: boolean;
}
