export function useAppBuildInfo() {
  const runtimeConfig = useRuntimeConfig()
  const label = computed(() => String(runtimeConfig.public.appBuildLabel || runtimeConfig.public.appVersion || '0.1.0'))
  const title = computed(() => [
    `Versi ${label.value}`,
    runtimeConfig.public.appBranch ? `Branch ${runtimeConfig.public.appBranch}` : '',
    runtimeConfig.public.appBuildDate ? `Build ${runtimeConfig.public.appBuildDate}` : ''
  ].filter(Boolean).join(' - '))

  return {
    label,
    title
  }
}
