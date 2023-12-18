declare module 'braintree-web/dist/browser/paypal-checkout' {
  import { PayPalCheckout, paypalCheckout } from 'braintree-web';
  import { PayPalCheckoutTokenizationOptions } from 'braintree-web/modules/paypal-checkout';

  export {
    PayPalCheckout,
    PayPalCheckoutTokenizationOptions
  }

  export default paypalCheckout
}
