// This object should represent structure of your modules Vuex state
// It's a good practice is to name this interface accordingly to the KET (for example mailchimpState)
import braintree from 'braintree-web';

export interface BraintreeState {
  trans: string[],
  selectedMethod: string | null,
  braintreeClient: braintree.Client | null,
  paymentData: {
    payment_method_nonce?: string,
    budsies_payment_method_code?: string
  }
}
