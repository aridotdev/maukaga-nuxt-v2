<script setup lang="ts">
definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageSection
        title="Fondasi database baru siap dibangun"
        description="Workflow pengajuan, API, service, dan UI operasional akan ditambahkan pada fase berikutnya di atas schema unified."
        icon="i-lucide-database"
      />
    </template>
  </UDashboardPanel>
</template>
