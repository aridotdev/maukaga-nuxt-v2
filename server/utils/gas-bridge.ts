import { createHmac, randomUUID } from 'node:crypto'

export type GasBridgeActor = {
  userId?: string
  email?: string
  role: string
  fullName?: string | null
}

export type GasBridgeRuntimeConfig = {
  gasBridgeSecret?: unknown
}

type GasBridgeOptions = {
  now?: () => number
  nonce?: () => string
}

const RESERVED_GAS_PAYLOAD_KEYS = new Set(['action', 'token', 'bridge', 'bridgeSignature'])

function stableStringifyValue(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (value === null) return 'null'

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringifyValue(item) ?? 'null').join(',')}]`
  }

  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => [key, stableStringifyValue(entryValue)] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0)

    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${entryValue}`).join(',')}}`
  }

  return undefined
}

export function stableStringify(value: unknown): string {
  return stableStringifyValue(value) ?? 'null'
}

export function createGasBridgeSignature(payload: Record<string, unknown>, secret: string): string {
  return createHmac('sha256', secret).update(stableStringify(payload)).digest('hex')
}

export function resolveGasBridgeSecret(runtimeConfig: GasBridgeRuntimeConfig): string {
  const secret = String(runtimeConfig.gasBridgeSecret || '').trim()
  if (!secret) throw new Error('GAS_BRIDGE_SECRET/NUXT_GAS_BRIDGE_SECRET belum dikonfigurasi.')
  return secret
}

function sanitizeGasPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !RESERVED_GAS_PAYLOAD_KEYS.has(key)),
  )
}

function normalizeGasBridgeActor(actor: GasBridgeActor): Record<string, string> {
  const normalizedActor = Object.fromEntries(
    Object.entries({
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      fullName: actor.fullName || undefined,
    }).map(([key, value]) => [key, String(value || '').trim()]).filter(([, value]) => value),
  )

  if (!normalizedActor.role) throw new Error('Role bridge admin tidak tersedia.')

  return normalizedActor
}

export function createSignedGasRequestBody(
  action: string,
  payload: Record<string, unknown>,
  runtimeConfig: GasBridgeRuntimeConfig,
  actor: GasBridgeActor,
  options: GasBridgeOptions = {},
): Record<string, unknown> {
  const secret = resolveGasBridgeSecret(runtimeConfig)
  const bridge = {
    version: 'v1',
    timestamp: options.now?.() ?? Date.now(),
    nonce: options.nonce?.() ?? randomUUID(),
    actor: normalizeGasBridgeActor(actor),
  }
  const unsignedPayload = {
    ...sanitizeGasPayload(payload),
    action,
    bridge,
  }

  return {
    ...unsignedPayload,
    bridgeSignature: createGasBridgeSignature(unsignedPayload, secret),
  }
}
