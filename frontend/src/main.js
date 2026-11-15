import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Home from './Home.vue';
import Placeholder from './Placeholder.vue';
import './style.css';
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: Home }, ...['dieta','allenati','progressi','altro'].map(path => ({ path: '/'+path, component: Placeholder, props: { section: path } })), { path: '/:pathMatch(.*)*', redirect: '/' }] });
createApp(App).use(createPinia()).use(router).mount('#app');
