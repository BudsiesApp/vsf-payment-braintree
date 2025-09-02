declare module 'braintree-web/dist/browser/paypal-checkout' {
  import { PayPalCheckout, paypalCheckout } from 'braintree-web';
  import { PayPalCheckoutTokenizationOptions } from 'braintree-web/modules/paypal-checkout';
  import { ShippingOptionType } from 'paypal-checkout-components';

  export {
    PayPalCheckout,
    PayPalCheckoutTokenizationOptions,
    ShippingOptionType
  }

  export default paypalCheckout
}
