<script setup lang="ts">
import * as z from 'zod'
import type { FormError } from '@nuxt/ui'

const passwordSchema = z.object({
  current: z.string().min(8, 'Must be at least 8 characters'),
  new: z.string().min(8, 'Must be at least 8 characters')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
  current: '',
  new: ''
})

const validate = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []
  if (state.current && state.new && state.current === state.new) {
    errors.push({ name: 'new', message: 'Passwords must be different' })
  }
  return errors
}
</script>

<template>
  <div class="space-y-4">
    <UPageCard
      title="Password"
      description="Confirm your current password before setting a new one."
      variant="subtle"
    >
      <UForm
        :schema="passwordSchema"
        :state="password"
        :validate="validate"
        class="flex flex-col gap-4 max-w-xs"
      >
        <UFormField name="current">
          <UInput
            v-model="password.current"
            type="password"
            placeholder="Current password"
            class="w-full"
          />
        </UFormField>

        <UFormField name="new">
          <UInput
            v-model="password.new"
            type="password"
            placeholder="New password"
            class="w-full"
          />
        </UFormField>

        <UButton label="Update" class="w-fit" type="submit" />
      </UForm>
    </UPageCard>

    <UPageCard
      title="Account"
      description="No longer want to use our service? You can delete your account here. This action is not reversible. All information related to this account will be deleted permanently."
      class="bg-linear-to-tl from-error/10 from-5% to-default"
    >
      <template #footer>
        <UButton label="Delete account" color="error" />
      </template>
    </UPageCard>

    <UPageCard
      title="Operasional Sync Lokal"
      description="Panduan manual untuk menjalankan sinkronisasi arsip dari halaman settings."
      variant="subtle"
    >
      <UAlert
        color="warning"
        icon="i-lucide-shield-alert"
        title="Jalankan hanya dari akun admin"
        description="Akses sync manual dibatasi ke admin yang login lewat Better Auth dan token GAS harus cocok di kedua sisi."
        variant="subtle"
        class="mb-4"
      />

      <div class="grid gap-4 md:grid-cols-2">
        <section class="rounded-lg border border-default bg-default/50 p-4">
          <h3 class="text-sm font-semibold text-highlighted">
            Prasyarat
          </h3>
          <ul class="mt-2 space-y-2 text-sm text-muted">
            <li>Pastikan `NUXT_GAS_BRIDGE_SECRET` di Nitro sama dengan `GAS_BRIDGE_SECRET` di Apps Script.</li>
            <li>Pastikan `appsScriptApiUrl` dan folder arsip lokal sudah terpasang.</li>
            <li>Login memakai akun admin aktif.</li>
          </ul>
        </section>

        <section class="rounded-lg border border-default bg-default/50 p-4">
          <h3 class="text-sm font-semibold text-highlighted">
            Kapan dijalankan
          </h3>
          <ul class="mt-2 space-y-2 text-sm text-muted">
            <li>Jalankan manual dari menu `Sinkronisasi Data` saat data butuh disalin ke SQLite lokal.</li>
            <li>Gunakan `mode` default `manual` dan turunkan `limit batch` kalau beban terlalu besar.</li>
          </ul>
        </section>

        <section class="rounded-lg border border-default bg-default/50 p-4">
          <h3 class="text-sm font-semibold text-highlighted">
            Cara cek hasil
          </h3>
          <ul class="mt-2 space-y-2 text-sm text-muted">
            <li>Lihat ringkasan status di halaman `Sinkronisasi Data` setelah sync selesai.</li>
            <li>Verifikasi data masuk ke dashboard source `Local` dan file tersimpan di `public/arsip_file`.</li>
          </ul>
        </section>

        <section class="rounded-lg border border-default bg-default/50 p-4">
          <h3 class="text-sm font-semibold text-highlighted">
            Retry bila gagal
          </h3>
          <ul class="mt-2 space-y-2 text-sm text-muted">
            <li>Cek pesan error terbaru di alert sync dan jalankan ulang dengan limit lebih kecil bila proses hanya sebagian.</li>
            <li>Kalau error terkait secret atau izin, periksa ulang konfigurasi env dan Script Property GAS.</li>
          </ul>
        </section>
      </div>
    </UPageCard>
  </div>
</template>
