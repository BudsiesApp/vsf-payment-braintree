// This object should represent structure of your modules Vuex state
// It's a good practice is to name this interface accordingly to the KET (for example mailchimpState)
import { Client } from 'braintree-web';

export interface BraintreeState {
  trans: string[],
  paymentMethodNonce?: string,
  braintreeClient?: Client,
  expirationDate?: number
}
