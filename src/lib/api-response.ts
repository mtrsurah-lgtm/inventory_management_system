import { NextResponse } from 'next/server';

export interface ApiResponseOptions<T> {
  data?: T;
  meta?: Record<string, any>;
  message?: string;
  status?: number;
}

export interface ApiErrorOptions {
  code?: string;
  message: string;
  details?: any;
  status?: number;
}

export function apiSuccess<T>({
  data,
  meta,
  message,
  status = 200,
}: ApiResponseOptions<T> = {}) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      meta,
    },
    { status }
  );
}

export function apiError({
  code = 'BAD_REQUEST',
  message,
  details,
  status = 400,
}: ApiErrorOptions) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

