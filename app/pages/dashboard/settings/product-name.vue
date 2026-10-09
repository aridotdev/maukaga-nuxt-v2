<script setup lang="ts">
definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

await navigateTo('/dashboard/master-data/product-name', {
  redirectCode: 301,
})
</script>

<template>
  <div />
</template>
