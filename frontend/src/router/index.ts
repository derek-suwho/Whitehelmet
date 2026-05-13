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
    {
      path: '/submissions',
      name: 'submissions',
      component: () => import('@/views/SubcontractorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/submissions/assignments/:assignmentId/fill',
      name: 'assignment-fill',
      component: () => import('@/views/SubcontractorTemplateEditorView.vue'),
      meta: { requiresAuth: true },
    },
    // ===== END GROUP 1 ROUTES =====

    // ===== GROUP 2 ROUTES — do not edit outside this block =====
    {
      path: '/admin',
      component: () => import('@/views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          redirect: { name: 'admin-dashboard' },
        },
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: () => import('@/views/admin/AdminOverviewDashboardView.vue'),
        },
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
          path: 'templates/:templateId/edit',
          name: 'admin-template-edit',
          component: () => import('@/views/admin/TemplateXlsxEditorView.vue'),
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
          path: 'projects',
          name: 'admin-projects',
          component: () => import('@/views/admin/ProjectListView.vue'),
        },
        {
          path: 'projects/:projectId',
          name: 'admin-project-detail',
          component: () => import('@/views/admin/ProjectDetailView.vue'),
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/UserManagementView.vue'),
        },
{
          path: 'freeform-uploads',
          name: 'admin-freeform-uploads',
          component: () => import('@/views/admin/FreeformUploadsView.vue'),
        },
        {
          path: 'master-template',
          name: 'admin-master-template',
          component: () => import('@/views/admin/AdminMasterTemplateView.vue'),
        },
        {
          path: 'templates/:templateId/edit-xlsx',
          name: 'admin-template-edit-xlsx',
          component: () => import('@/views/admin/TemplateXlsxEditorView.vue'),
        },
        {
          path: 'master-sheets/:sheetId',
          name: 'admin-master-sheet',
          component: () => import('@/views/admin/MasterSheetEditorView.vue'),
        },
        {
          path: 'submissions/:submissionId/review',
          name: 'admin-submission-review',
          component: () => import('@/views/admin/SubmissionReviewView.vue'),
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

  const isAdmin = auth.user?.role === 'super_admin' || auth.user?.role === 'coe_admin'

  // Redirect authenticated users away from login/signup
  if ((to.name === 'login' || to.name === 'signup') && auth.user) {
    return isAdmin ? { name: 'admin-dashboard' } : { name: 'submissions' }
  }

  // Intercept post-login 'dashboard' push (LoginView calls router.push({ name: 'dashboard' }))
  if (to.name === 'dashboard' && auth.user) {
    return isAdmin ? { name: 'admin-dashboard' } : { name: 'submissions' }
  }

  if (to.meta.requiresAdmin && !isAdmin) {
    return { name: 'submissions' }
  }
})

export default router
