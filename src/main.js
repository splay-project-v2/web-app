import Vue from 'vue'
import App from './App.vue'
import BootstrapVue from 'bootstrap-vue'
import router from './router'

Vue.config.productionTip = false

Vue.use(BootstrapVue)

new Vue({
  render: h=> h(App),
  router,
}).$mount('#app')
