import { runArchiveSync } from '../../utils/archive-sync'

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)
  const body = typeof rawBody === 'string'
    ? JSON.parse(rawBody)
    : rawBody
  const runtimeConfig = useRuntimeConfig()

  const result = await runArchiveSync(body, {
    runtimeConfig: {
      appsScriptApiUrl: runtimeConfig.appsScriptApiUrl,
      archiveFileDirectory: runtimeConfig.archiveFileDirectory,
      public: {
        archiveFileBasePath: runtimeConfig.public.archiveFileBasePath,
      },
    },
  })

  return {
    success: true,
    data: result,
  }
})
