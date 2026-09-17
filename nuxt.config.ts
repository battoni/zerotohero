import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@nuxtjs/i18n', '@nuxt/eslint', '@nuxt/test-utils/module'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  app: {
    head: {
      title: 'Zero to Hero',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,500&family=IBM+Plex+Mono:wght@500&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      devLogin: process.env.NUXT_PUBLIC_DEV_LOGIN || 'false',
    },
  },

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: ['/tracks(/*)?', '/explore', '/friends', '/settings', '/welcome', '/pt-BR/tracks(/*)?', '/pt-BR/explore', '/pt-BR/friends', '/pt-BR/settings', '/pt-BR/welcome'],
      exclude: [],
      saveRedirectToCookie: true,
    },
    types: '~~/shared/types/database.ts',
  },

  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'pt-BR', language: 'pt-BR', name: 'Português', file: 'pt-BR.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'zth_locale',
      redirectOn: 'root',
    },
  },

  eslint: {
    config: { stylistic: false },
  },

  typescript: { strict: true },
})
