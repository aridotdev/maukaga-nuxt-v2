<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: defineNuxtRouteMiddleware(() => {
    if (import.meta.client && !sessionStorage.getItem('admin_token')) {
      return navigateTo('/login')
    }
  })
})
</script>

<template>
  <NuxtPage />
</template>
