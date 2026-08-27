import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type PackageJson = {
  version?: string
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as PackageJson

function clean(value?: string) {
  return String(value || '').trim()
}

function shortRevision(value: string) {
  return value.trim().slice(0, 8)
}

export function createPublicAppBuildInfo() {
  const version = clean(process.env.NUXT_PUBLIC_APP_VERSION) || clean(packageJson.version) || '0.1.0'
  const revision = clean(process.env.NUXT_PUBLIC_APP_REVISION)
    || clean(process.env.CF_PAGES_COMMIT_SHA)
    || clean(process.env.COMMIT_SHA)
    || clean(process.env.VERCEL_GIT_COMMIT_SHA)
  const revisionShort = shortRevision(revision)
  const branch = clean(process.env.NUXT_PUBLIC_APP_BRANCH)
    || clean(process.env.CF_PAGES_BRANCH)
    || clean(process.env.BRANCH)
    || clean(process.env.VERCEL_GIT_COMMIT_REF)
  const buildDate = clean(process.env.NUXT_PUBLIC_APP_BUILD_DATE) || new Date().toISOString()
  const deployUrl = clean(process.env.NUXT_PUBLIC_APP_DEPLOY_URL) || clean(process.env.CF_PAGES_URL)

  return {
    appVersion: version,
    appRevision: revision,
    appRevisionShort: revisionShort,
    appBranch: branch,
    appBuildDate: buildDate,
    appBuildLabel: revisionShort ? `${version}+${revisionShort}` : version,
    appDeployUrl: deployUrl
  }
}
