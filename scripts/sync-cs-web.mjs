import { constants as fsConstants } from 'node:fs'
import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const checkOnly = process.argv.includes('--check')

const managedFiles = [
  ['app/app.vue', 'apps/cs-web/app.vue'],
  ['app/app.config.ts', 'apps/cs-web/app.config.ts'],
  ['app/composables/useAppBuildInfo.ts', 'packages/shared/app/composables/useAppBuildInfo.ts'],
  ['app/composables/useCsAppsScriptApi.ts', 'packages/shared/app/composables/useCsAppsScriptApi.ts'],
  ['app/composables/useCsDraftReferenceStorage.ts', 'packages/shared/app/composables/useCsDraftReferenceStorage.ts'],
  ['app/pages/index.vue', 'apps/cs-web/pages/index.vue'],
  ['app/pages/new.vue', 'apps/cs-web/pages/new.vue'],
  ['app/pages/check-status.vue', 'apps/cs-web/pages/check-status.vue'],
  ['app/pages/final-submit.vue', 'apps/cs-web/pages/final-submit.vue'],
  ['app/pages/print-ulang.vue', 'apps/cs-web/pages/print-ulang.vue'],
  ['public/favicon.ico', 'apps/cs-web/public/favicon.ico'],
  ['public/robots.txt', 'apps/cs-web/public/robots.txt'],
  ['app/layouts/cs.vue', 'apps/cs-web/layouts/cs.vue'],
  ['app/pages/panduan.vue', 'apps/cs-web/pages/panduan.vue'],
]

const forbiddenCsWebPaths = [
  'apps/cs-web/components',
  'apps/cs-web/composables',
  'apps/cs-web/middleware',
  'apps/cs-web/server',
  'apps/cs-web/pages/coba.vue',
  'apps/cs-web/pages/confirm.vue',
  'apps/cs-web/pages/dashboard',
  'apps/cs-web/pages/dashboard.vue',
  'apps/cs-web/pages/login.vue'
]

function resolvePath(path) {
  return join(repoRoot, path)
}

function displayPath(path) {
  return relative(repoRoot, path).replaceAll('\\', '/')
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function assertNoForbiddenFiles() {
  const found = []

  for (const path of forbiddenCsWebPaths) {
    const absolutePath = resolvePath(path)
    if (await exists(absolutePath)) found.push(displayPath(absolutePath))
  }

  if (found.length) {
    throw new Error([
      'CS web contains files that should stay out of the static CS artifact:',
      ...found.map(path => `- ${path}`)
    ].join('\n'))
  }
}

async function filesMatch(sourcePath, targetPath) {
  if (!(await exists(targetPath))) return false

  const [source, target] = await Promise.all([
    readFile(sourcePath),
    readFile(targetPath)
  ])

  return source.equals(target)
}

async function syncFile(source, target) {
  const sourcePath = resolvePath(source)
  const targetPath = resolvePath(target)
  const matches = await filesMatch(sourcePath, targetPath)

  if (checkOnly) {
    return {
      changed: !matches,
      message: matches
        ? `ok      ${target}`
        : `outdated ${target} <- ${source}`
    }
  }

  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)

  return {
    changed: !matches,
    message: `${matches ? 'kept' : 'synced'}  ${target} <- ${source}`
  }
}

await assertNoForbiddenFiles()

const results = []
for (const [source, target] of managedFiles) {
  results.push(await syncFile(source, target))
}

for (const result of results) {
  console.info(result.message)
}

const changedCount = results.filter(result => result.changed).length

if (checkOnly && changedCount > 0) {
  throw new Error(`${changedCount} CS web file(s) are not in sync with the root CS app.`)
}

console.info(
  checkOnly
    ? 'CS web is in sync with the root CS app.'
    : 'CS web sync finished.'
)
