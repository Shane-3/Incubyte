export interface ErrorDetail {
  field: string;
  message: string;
}

/** Base for every expected error. The central error handler maps these to the standard JSON error shape. */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class EmailTakenError extends AppError {
  readonly status = 409;
  readonly code = 'EMAIL_TAKEN';

  constructor() {
    super('Email is already registered');
  }
}
