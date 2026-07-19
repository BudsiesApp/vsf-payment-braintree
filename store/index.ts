import { Module } from 'vuex'
import { BraintreeState } from '../types/BraintreeState'
import { mutations } from './mutations'
import { getters } from './getters'
import { actions } from './actions'

const storeModule: Module<BraintreeState, any> = {
  namespaced: true,
  state: {
    trans: [],
    paymentMethodNonce: undefined,
    braintreeClient: undefined,
    expirationDate: Date.now(),
    paypalCheckoutInstance: undefined,
    paypalSdkLoadPromise: undefined,
    isPayPalSdkLoaded: false
  },
  mutations,
  actions,
  getters
}

export { storeModule as module }
