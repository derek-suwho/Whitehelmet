<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-4">
    <div class="text-center">
      <h1 class="font-display text-2xl text-brand-400">Account access</h1>
      <p class="mt-3 text-sm text-gray-400">
        Contact your administrator to create an account.
      </p>
      <router-link :to="{ name: 'login' }" class="mt-6 inline-block text-sm text-brand-400 hover:text-brand-300">
        Back to login
      </router-link>
    </div>
  </div>
</template>
