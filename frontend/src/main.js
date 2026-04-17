/**
 * Einstiegspunkt der Vue-App.
 * Registriert Router und mountet die Anwendung am Root-Element.
 */
import './assets/main.css';

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

createApp(App).use(router).mount('#app');
