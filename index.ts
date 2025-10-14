import { StorefrontModule } from '@vue-storefront/core/lib/modules';
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'
import PaymentMethod from 'core/modules/cart/types/PaymentMethod';

import { module } from './store'
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from './store/mutation-types';
import getComponentByMethodCode from './helpers/get-component-by-method-code.function';
import supportedMethodsCodes from './types/SupportedMethodsCodes';
import googlePayIcon from './assets/google-pay-mark.svg';
import paypalIcon from './assets/paypal-icon.svg';
import applePayIcon from './assets/apple-pay-icon.svg';
import cardsIcon from './assets/cards-icon.png';

import PaymentApplePay from './components/payment-apple-pay.vue';
import PaymentGooglePay from './components/payment-google-pay.vue';
import PaymentPayPal from './components/payment-pay-pal.vue';

export const Braintree: StorefrontModule = function ({ app, store }) {
  if (!app.$isServer && !store.hasModule(SN_BRAINTREE)) {
    store.registerModule(SN_BRAINTREE, module);
    store.dispatch('braintree/createBraintreeClient');

    let isCurrentPaymentMethod = false

    EventBus.$on('checkout-payment-method-changed', (paymentMethodCode: string) => {
      isCurrentPaymentMethod = Object.values(supportedMethodsCodes)
        .includes(paymentMethodCode as supportedMethodsCodes);
    });

    EventBus.$on('collect-methods-handled-by-other-modules', (methods: string[]) => {
      methods.push(...Object.values(supportedMethodsCodes));
    });

    const invokePlaceOrder = () => {
      if (isCurrentPaymentMethod) {
        const paymentMethodNonce = store.getters['braintree/paymentMethodNonce'];
        EventBus.$emit('checkout-do-placeOrder', { payment_method_nonce: paymentMethodNonce })
        store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, undefined);
      }
    }

    const onBeforeReplacePaymentMethods = (methods: PaymentMethod[]) => {
      methods.forEach((method) => {
        if (!method.code || !Object.values(supportedMethodsCodes).includes(method.code as supportedMethodsCodes)) {
          return;
        }

        switch (method.code) {
          case supportedMethodsCodes.PAY_PAL:
          case supportedMethodsCodes.MAGENTO1_PAY_PAL:
            method.hint = app.$t('You will complete your payment via PayPal. After You will make payment, order will be automatically placed').toString();
            method.icon = paypalIcon;
            break;
          case supportedMethodsCodes.APPLE_PAY:
          case supportedMethodsCodes.MAGENTO1_APPLE_PAY:
            method.hint = app.$t('You will be presented with Apple Pay at the end of the checkout process').toString();
            method.icon = applePayIcon;
            break;
          case supportedMethodsCodes.CARD:
          case supportedMethodsCodes.MAGENTO1_CARD:
            method.icon = cardsIcon;
            break;
          case supportedMethodsCodes.GOOGLE_PAY:
            method.icon = googlePayIcon;
            break;
        }
      })
    };

    EventBus.$on('checkout-before-placeOrder', invokePlaceOrder);
    EventBus.$on('before-replace-payment-methods', onBeforeReplacePaymentMethods);
  }
}

const SET_PAYMENT_METHOD_NONCE_MUTATION = `${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`;

export {
  getComponentByMethodCode,
  supportedMethodsCodes,
  PaymentApplePay,
  PaymentGooglePay,
  PaymentPayPal,
  SET_PAYMENT_METHOD_NONCE_MUTATION
};
