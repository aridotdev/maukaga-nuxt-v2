<script setup lang="ts">
await navigateTo('/dashboard/settings/layout-kartu', { replace: true })
definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})
</script>

<template>
  <div />
</template>
