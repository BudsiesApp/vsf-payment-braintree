import { StorefrontModule } from '@vue-storefront/core/lib/modules';
import { StorageManager } from '@vue-storefront/core/lib/storage-manager'
import { coreHooks } from '@vue-storefront/core/hooks';

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
      store.watch((state) => state.checkout.paymentDetails, (prevMethodCode, newMethodCode) => {
        isCurrentPaymentMethod = newMethodCode.paymentMethod === CURRENT_METHOD_CODE
      })

      const invokePlaceOrder = () => {
        if (isCurrentPaymentMethod) {
          app.$emit('checkout-do-placeOrder', {})
        }
      }
      app.$on('checkout-before-placeOrder', invokePlaceOrder)
    }
  })
}
