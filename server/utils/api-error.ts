import { createError } from 'h3'
import { ZodError } from 'zod'

export function normalizeApiError(error: unknown): never {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    throw error
  }

  if (error instanceof ZodError) {
    throw createError({
      statusCode: 400,
      statusMessage: error.issues[0]?.message ?? 'Payload tidak valid',
    })
  }

  throw error
}
