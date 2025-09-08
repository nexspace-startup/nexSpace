export type ApiSuccess<T> = { success: true; data: T; errors: [] };
export type ApiFailure = { success: false; data: null; errors: any[] };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
