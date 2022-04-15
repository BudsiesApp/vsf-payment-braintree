import { BraintreeState } from '../types/BraintreeState'
import { GetterTree } from 'vuex';

export const getters: GetterTree<BraintreeState, any> = {
  paymentMethodNonce: (state) => state.paymentMethodNonce
}
