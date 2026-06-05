import { ERROR_CATALOG, ErrorCode, ErrorDescriptor } from './error-codes';

export interface AppExceptionOptions {
  /** Override default detail message from the catalog. */
  detail?: string;
  /** Extra fields to expose in the problem+json body (avoid PII). */
  extra?: Record<string, unknown>;
  /** Underlying cause for logging (not serialized in response). */
  cause?: unknown;
}

export class AppException extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly extra: Record<string, unknown> | undefined;
  override readonly cause: unknown;

  constructor(code: ErrorCode, opts: AppExceptionOptions = {}) {
    const desc: ErrorDescriptor = ERROR_CATALOG[code];
    super(opts.detail ?? desc.detail);
    this.name = 'AppException';
    this.code = code;
    this.status = desc.status;
    this.title = desc.title;
    this.detail = opts.detail ?? desc.detail;
    this.extra = opts.extra;
    this.cause = opts.cause;
  }
}
