import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/views/SignupView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'workspace',
      component: () => import('@/views/WorkspaceView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },

    // ===== GROUP 1 ROUTES — do not edit outside this block =====
    // ===== END GROUP 1 ROUTES =====

    // ===== GROUP 2 ROUTES — do not edit outside this block =====
    {
      path: '/admin',
      component: () => import('@/views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true, role: 'pif_admin' },
      children: [
        {
          path: 'templates',
          name: 'admin-templates',
          component: () => import('@/views/admin/TemplateListView.vue'),
        },
        {
          path: 'templates/new',
          name: 'admin-template-new',
          component: () => import('@/views/admin/TemplateBuilderView.vue'),
        },
        {
          path: 'templates/:id/edit',
          name: 'admin-template-edit',
          component: () => import('@/views/admin/TemplateBuilderView.vue'),
        },
        {
          path: 'templates/:id',
          name: 'admin-template-detail',
          component: () => import('@/views/admin/TemplateDetailView.vue'),
        },
        {
          path: 'consolidations/:templateId',
          name: 'admin-consolidation',
          component: () => import('@/views/admin/ConsolidationDashboardView.vue'),
        },
        {
          path: 'organizations',
          name: 'admin-organizations',
          component: () => import('@/views/admin/OrganizationListView.vue'),
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/UserManagementView.vue'),
        },
      ],
    },
    // ===== END GROUP 2 ROUTES =====

    // ===== GROUP 3 ROUTES — do not edit outside this block =====
    // ===== END GROUP 3 ROUTES =====
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.checked) {
    await auth.checkSession()
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login' }
  }

  // Redirect authenticated users away from login/signup to dashboard
  if ((to.name === 'login' || to.name === 'signup') && auth.user) {
    return { name: 'dashboard' }
  }

  if (to.meta.role === 'pif_admin' && auth.profile?.role !== 'pif_admin') {
    return { name: 'workspace' }
  }
})

export default router
