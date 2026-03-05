import { Client, PayPalCheckout } from 'braintree-web';
import Vue from 'vue';
import { MutationTree } from 'vuex';

import * as types from './mutation-types';

export const mutations: MutationTree<any> = {
  [types.SET_PAYMENT_METHOD_NONCE] (state, payload) {
    Vue.set(state, 'paymentMethodNonce', payload);
  },
  [types.SET_BRAINTREE_CLIENT] (state, payload: Client | undefined) {
    Vue.set(state, 'braintreeClient', payload);
  },
  [types.SET_BRAINTREE_CLIENT_EXPIRATION_DATE] (state, payload: number | undefined) {
    Vue.set(state, 'expirationDate', payload);
  },
  [types.SET_BRAINTREE_CLIENT_CREATION_PROMISE] (state, payload: Promise<Client> | undefined) {
    Vue.set(state, 'braintreeClientCreationPromise', payload);
  },
  [types.SET_PAYPAL_CHECKOUT_INSTANCE] (state, payload: PayPalCheckout | undefined) {
    Vue.set(state, 'paypalCheckoutInstance', payload);
  },
  [types.SET_PAYPAL_SDK_LOAD_PROMISE] (state, payload: Promise<void> | undefined) {
    Vue.set(state, 'paypalSdkLoadPromise', payload);
  },
  [types.SET_IS_PAYPAL_SDK_LOADED] (state, payload: boolean) {
    Vue.set(state, 'isPayPalSdkLoaded', payload);
  }
}
