import pluginVue from 'eslint-plugin-vue'

export default [
  ...pluginVue.configs['flat/vue3-recommended'],
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
]
