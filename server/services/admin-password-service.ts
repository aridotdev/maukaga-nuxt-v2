import { fromNodeHeaders } from 'better-auth/node'
import { createError, type H3Event } from 'h3'
import * as z from 'zod'
import { auth } from '../lib/auth'

export const setAdminPasswordInputSchema = z.object({
  newPassword: z.string().min(8, 'Password minimal 8 karakter').max(200, 'Password terlalu panjang'),
})

export async function setAdminPassword(event: H3Event, input: unknown) {
  const data = setAdminPasswordInputSchema.parse(input)

  try {
    await auth.api.setPassword({
      body: {
        newPassword: data.newPassword,
      },
      headers: fromNodeHeaders(event.node.req.headers),
    })

    return { success: true }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error

    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Password gagal disimpan',
    })
  }
}
