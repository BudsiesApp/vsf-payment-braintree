import { Module } from 'vuex'
import { BraintreeState } from '../types/BraintreeState'
import { mutations } from './mutations'
import { getters } from './getters'
import { actions } from './actions'
import { plugin } from './plugin'

export const module: Module<BraintreeState, any> = {
  namespaced: true,
  state: {
    trans: null,
    selectedMethod: null,
    braintreeClient: null,
    paymentData: {}
  },
  mutations,
  actions,
  getters
}
