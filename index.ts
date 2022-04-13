import { StorefrontModule } from '@vue-storefront/core/lib/modules';
import { coreHooks } from '@vue-storefront/core/hooks';
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'

import { module } from './store'
import { SET_PAYMENT_DATA, SN_BRAINTREE } from './store/mutation-types';
import getComponentByMethodCode from './helpers/get-component-by-method-code.function';
import supportedMethodsCodes from './types/SupportedMethodsCodes';

export const Braintree: StorefrontModule = function ({ app, store }) {
  store.registerModule(SN_BRAINTREE, module);

  coreHooks.afterAppInit(() => {
    if (!app.$isServer) {
      let isCurrentPaymentMethod = false

      EventBus.$on('checkout-payment-method-changed', (paymentMethodCode: string) => {
        isCurrentPaymentMethod = Object.values(supportedMethodsCodes)
          .includes(paymentMethodCode);
      });

      EventBus.$on('collect-methods-handled-by-other-modules', (methods: string[]) => {
        methods.push(...Object.values(supportedMethodsCodes));
      });

      const invokePlaceOrder = () => {
        if (isCurrentPaymentMethod) {
          const paymentData = store.getters['braintree/paymentData'];
          EventBus.$emit('checkout-do-placeOrder', { ...paymentData })
          store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_DATA}`, {});
        }
      }

      EventBus.$on('checkout-before-placeOrder', invokePlaceOrder)
    }
  })
}

export { getComponentByMethodCode, supportedMethodsCodes };
