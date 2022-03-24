import { BraintreeState } from '../types/BraintreeState'
import { GetterTree } from 'vuex';

export const getters: GetterTree<BraintreeState, any> = {
  selectedMethod: (state) => state.selectedMethod,
  braintreeClient: (state) => state.braintreeClient,
  paymentData: (state) => state.paymentData
}
