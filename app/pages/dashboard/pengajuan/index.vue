<script setup lang="ts">
definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})
</script>

<template>
  <UDashboardPanel id="pengajuan">
    <template #header>
      <UDashboardNavbar title="Pengajuan Kartu Garansi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            variant="solid"
            icon="i-lucide-plus"
            to="/dashboard/pengajuan/create"
            target="_blank"
          >
            Pengajuan Baru
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageSection
        title="Halaman Pengajuan Kartu Garansi"
        description="halaman index pengajuan kartu garansi, menampilkan data table daftar pengajuan yang telah dibuat oleh user. "
        icon="i-lucide-database"
      />
      </template>
  </UDashboardPanel>
</template>
