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

export class InvalidCredentialsError extends AppError {
  readonly status = 401;
  readonly code = 'UNAUTHENTICATED';

  constructor() {
    super('Invalid email or password');
  }
}

export class UnauthenticatedError extends AppError {
  readonly status = 401;
  readonly code = 'UNAUTHENTICATED';

  constructor() {
    super('Authentication required');
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(details: ErrorDetail[], message = 'Request validation failed') {
    super(message, details);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = 'FORBIDDEN';

  constructor(message = 'You do not have permission to do that') {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND';

  constructor(message = 'Not found') {
    super(message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  readonly status = 415;
  readonly code = 'UNSUPPORTED_MEDIA_TYPE';

  constructor() {
    super('Request body must be application/json');
  }
}

export class VehicleNotFoundError extends NotFoundError {
  constructor() {
    super('Vehicle not found');
  }
}

export class OutOfStockError extends AppError {
  readonly status = 409;
  readonly code = 'OUT_OF_STOCK';

  constructor(available: number) {
    super(available === 0 ? 'Vehicle is out of stock' : `Only ${available} left in stock`);
  }
}
