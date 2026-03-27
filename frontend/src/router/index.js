import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/components/ShoppingList.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation Guard: schützt Routen vor unauthentifizierten Nutzern
router.beforeEach(async (to) => {
  const { currentUser, checkSession } = useAuth();

  // Session einmalig prüfen wenn kein User im Speicher
  if (!currentUser.value) {
    await checkSession();
  }

  if (to.meta.requiresAuth && !currentUser.value) {
    return { name: 'login' };
  }

  if (to.meta.requiresGuest && currentUser.value) {
    return { name: 'home' };
  }
});

export default router;
