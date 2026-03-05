// This object should represent structure of your modules Vuex state
// It's a good practice is to name this interface accordingly to the KET (for example mailchimpState)
import { Client, PayPalCheckout } from 'braintree-web';

export interface BraintreeState {
  trans: string[],
  paymentMethodNonce?: string,
  braintreeClient?: Client,
  expirationDate?: number,
  braintreeClientCreationPromise?: Promise<Client>,
  paypalCheckoutInstance?: PayPalCheckout,
  paypalSdkLoadPromise?: Promise<void>,
  isPayPalSdkLoaded: boolean
}
