<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false
})

const toast = useToast()
const { getSession, refreshSession } = useCurrentSession()
const { fetchProfile, hasValidRole, isActive } = useUserProfile()
const { syncLegacySession } = useAuthBridge()

const schema = z.object({
  password: z.string('Password wajib diisi').min(8, 'Password minimal 8 karakter'),
  passwordConfirm: z.string('Konfirmasi password wajib diisi').min(8, 'Konfirmasi password minimal 8 karakter')
}).refine((value) => value.password === value.passwordConfirm, {
  message: 'Konfirmasi password tidak sama',
  path: ['passwordConfirm']
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  password: '',
  passwordConfirm: ''
})

const isVerifying = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)
const showPasswordConfirm = ref(false)

onMounted(async () => {
  try {
    await completeInviteSession()
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    isVerifying.value = false
  }
})

async function completeInviteSession() {
  const session = await getSession()
  if (!session) throw new Error('Link undangan tidak valid atau sudah kedaluwarsa.')

  await fetchProfile()
  if (!hasValidRole.value || !isActive.value) {
    throw new Error('Akun tidak memiliki akses dashboard.')
  }
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSaving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/admin/password', {
      method: 'POST',
      body: {
        newPassword: event.data.password
      }
    })
    await refreshSession()
    await fetchProfile()
    await syncLegacySession()

    toast.add({
      title: 'Password berhasil disimpan',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    await navigateTo('/dashboard')
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-default px-6 py-12">
    <section class="w-full max-w-sm space-y-6">
      <div class="space-y-2 text-center">
        <div class="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UIcon name="i-lucide-key-round" class="size-6" />
        </div>
        <h1 class="text-2xl font-bold text-highlighted">
          Aktivasi Akun
        </h1>
        <p class="text-sm text-muted">
          Buat password untuk menyelesaikan undangan dashboard.
        </p>
      </div>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :title="errorMessage"
      />

      <div v-if="isVerifying" class="flex items-center justify-center gap-2 py-8 text-sm text-muted">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
        Memverifikasi undangan...
      </div>

      <UForm
        v-else
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Password baru" name="password" size="lg">
          <UInput
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField label="Konfirmasi password" name="passwordConfirm" size="lg">
          <UInput
            v-model="state.passwordConfirm"
            :type="showPasswordConfirm ? 'text' : 'password'"
            autocomplete="new-password"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showPasswordConfirm ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="showPasswordConfirm ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'"
                @click="showPasswordConfirm = !showPasswordConfirm"
              />
            </template>
          </UInput>
        </UFormField>

        <UButton
          type="submit"
          label="Simpan Password"
          icon="i-lucide-check"
          size="xl"
          class="w-full justify-center"
          :loading="isSaving"
          :disabled="isSaving"
        />
      </UForm>
    </section>
  </main>
</template>
