export interface ApiError {
  message: string;
  code?: string;
  field?: string;
}

export type ApiSuccess<T> = {
  success: true;
  data: T;
  errors: [];
};

export type ApiFailure = {
  success: false;
  data: null;
  errors: ApiError[];
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export const isApiSuccess = <T>(payload: ApiEnvelope<T>): payload is ApiSuccess<T> => payload.success;

export const firstApiError = (payload?: ApiEnvelope<unknown> | null): string | null => {
  if (!payload || payload.success) return null;
  const [first] = payload.errors;
  return first?.message ?? null;
};
