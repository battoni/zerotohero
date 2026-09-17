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
      meta: [
        { name: 'theme-color', content: '#5B3FE6' },
        { property: 'og:site_name', content: 'Zero to Hero' },
        { property: 'og:type', content: 'website' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
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
    // Server keys are runtime-only (NUXT_SUPABASE_SECRET_KEY). Empty here so the module
    // doesn't copy a key found at build time into the server bundle.
    supabase: { secretKey: '', serviceKey: '' },
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      devLogin: process.env.NUXT_PUBLIC_DEV_LOGIN || 'false',
      // `demo` runs entirely in the browser with seeded data; the default when no Supabase URL is set.
      dataMode: process.env.NUXT_PUBLIC_DATA_MODE || (process.env.NUXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'demo'),
    },
  },

  supabase: {
    // Placeholders keep demo mode (no backend) booting; real values come from .env.
    url: process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.invalid',
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY || 'demo-publishable-key',
    // Route protection lives in app/middleware/auth.global.ts so it covers demo mode too.
    redirect: false,
    types: '~~/shared/types/database.ts',
  },

  i18n: {
    // Absolute URLs for hreflang alternates and og:url.
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
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
