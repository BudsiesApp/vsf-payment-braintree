import { StorefrontModule } from '@vue-storefront/core/lib/modules';
import { StorageManager } from '@vue-storefront/core/lib/storage-manager'
import { coreHooks } from '@vue-storefront/core/hooks';
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'

import { module } from './store'
import { plugin } from './store/plugin';
import { SN_BRAINTREE } from './store/mutation-types';

export const Braintree: StorefrontModule = function ({ app, store }) {
  store.registerModule(SN_BRAINTREE, module);

  coreHooks.afterAppInit(() => {
    const CURRENT_METHOD_CODE = 'braintree'

    store.dispatch('checkout/addPaymentMethod', {
      'title': 'Braintree',
      'code': CURRENT_METHOD_CODE,
      'cost': 0,
      'costInclTax': 0,
      'default': true,
      'offline': false
    })

    store.subscribe(plugin);

    StorageManager.init(SN_BRAINTREE);

    if (!app.$isServer) {
      store.dispatch('braintree/synchronize');
      let isCurrentPaymentMethod = false

      EventBus.$on('checkout-payment-method-changed', (paymentMethodCode: string) => {
        isCurrentPaymentMethod = paymentMethodCode === CURRENT_METHOD_CODE;
      })

      const invokePlaceOrder = () => {
        if (isCurrentPaymentMethod) {
          const paymentData = store.getters['braintree/paymentData'];
          EventBus.$emit('checkout-do-placeOrder', paymentData)
        }
      }

      EventBus.$on('checkout-before-placeOrder', invokePlaceOrder)
    }
  })
}
