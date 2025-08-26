import { Client } from 'braintree-web';
import Vue from 'vue'
import { MutationTree } from 'vuex'

import * as types from './mutation-types';

export const mutations: MutationTree<any> = {
  [types.SET_USERS] (state, payload) {
    state.users = payload
  },
  [types.ADD_USER] (state, payload) {
    state.users.push(payload)
  },
  [types.SET_PAYMENT_METHOD_NONCE] (state, payload) {
    Vue.set(state, 'paymentMethodNonce', payload);
  },
  [types.SET_BRAINTREE_CLIENT] (state, payload: Client | undefined) {
    Vue.set(state, 'braintreeClient', payload);
  },
  [types.SET_BRAINTREE_CLIENT_EXPIRATION_DATE] (state, payload: number | undefined) {
    Vue.set(state, 'expirationDate', payload)
  }
}
