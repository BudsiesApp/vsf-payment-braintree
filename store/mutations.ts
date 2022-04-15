import Vue from 'vue'
import { MutationTree } from 'vuex'
import * as types from './mutation-types'

export const mutations: MutationTree<any> = {
  [types.SET_USERS] (state, payload) {
    state.users = payload
  },
  [types.ADD_USER] (state, payload) {
    state.users.push(payload)
  },
  [types.SET_PAYMENT_METHOD_NONCE] (state, payload) {
    Vue.set(state, 'paymentMethodNonce', payload);
  }
}
