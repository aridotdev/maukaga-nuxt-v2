import { fromNodeHeaders } from 'better-auth/node'
import { createError, type H3Event } from 'h3'
import * as z from 'zod'
import { auth } from '../lib/auth'
import { requireAdminSession } from './admin-auth-service'

const setPasswordBodySchema = z.object({
  newPassword: z.string().min(8, 'Password minimal 8 karakter')
})

type SetPasswordBody = z.infer<typeof setPasswordBodySchema>

function toPasswordError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error

  return createError({
    statusCode: 400,
    statusMessage: error instanceof Error ? error.message : String(error),
  })
}

export async function setAdminPassword(event: H3Event, body: unknown) {
  await requireAdminSession(event)

  const parsedBody = setPasswordBodySchema.safeParse(body)
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.issues[0]?.message || 'Password tidak valid',
    })
  }

  try {
    const payload: SetPasswordBody = parsedBody.data

    await auth.api.setPassword({
      body: {
        newPassword: payload.newPassword,
      },
      headers: fromNodeHeaders(event.node.req.headers),
    })

    return {
      success: true,
    }
  } catch (error) {
    throw toPasswordError(error)
  }
}
