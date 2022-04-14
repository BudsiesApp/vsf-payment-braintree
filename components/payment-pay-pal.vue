<template>
  <div class="payment-pay-pal">
    <slot name="title" />

    <div
      class="_pay-pal-button-container"
      id="pay-pal-button-container"
      v-show="showContent"
    />
  </div>
</template>

<script lang="ts">
import braintree, { PayPalCheckout } from 'braintree-web';
import { PayPalCheckoutTokenizationOptions } from 'braintree-web/modules/paypal-checkout';

import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_DATA, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';

enum FlowType {
  Vault = 'vault',
  Checkout = 'checkout'
}

enum Intent {
  Authorize = 'authorize',
  Order = 'order',
  Capture = 'capture'
}

const PAYMENT_METHOD_CODE = 'gene_braintree_paypal';

export default PaymentMethod.extend({
  name: 'PaymentPayPal',
  async created (): Promise<void> {
    try {
      const paypalCheckoutInstance = await braintree.paypalCheckout.create({
        client: this.braintreeClient
      });

      await paypalCheckoutInstance.loadPayPalSDK({
        currency: this.currency,
        intent: 'capture'
      });

      await this.onPayPalSdkLoaded(paypalCheckoutInstance);
    } catch (error) {
      this.$emit('error', error);
    }
  },
  methods: {
    async onPayPalSdkLoaded (paypalCheckoutInstance: PayPalCheckout): Promise<void> {
      const paypal = (this.window as any).paypal;
      if (!paypal) {
        return;
      }

      const buttons = await paypal.Buttons({
        fundingSource: paypal.FUNDING.PAYPAL,
        style: {
          label: 'pay',
          color: 'blue'
        },
        createOrder: () => {
          return paypalCheckoutInstance.createPayment({
            flow: FlowType.Checkout,
            amount: this.total,
            currency: this.currency,
            intent: Intent.Capture
          });
        },
        onApprove: (data: PayPalCheckoutTokenizationOptions) => {
          return paypalCheckoutInstance.tokenizePayment(data, (error, payload) => {
            if (error) {
              this.$emit('error', error);
              return;
            }

            this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_DATA}`, {
              payment_method_nonce: payload.nonce,
              budsies_payment_method_code: PAYMENT_METHOD_CODE
            });

            this.$emit('success');
          })
        },
        onError: (error: string) => {
          this.$emit('error', error)
        }
      });

      buttons.render('#pay-pal-button-container');
    }
  }
})
</script>

<style lang="scss" scoped>
@import '~@storefront-ui/shared/styles/helpers/breakpoints';

.payment-pay-pal {
  ._pay-pal-button-container {
      display: flex;
      margin-top: var(--spacer-sm);
      justify-content: center;
      align-items: center;
      padding: 0;
  }

  @include for-desktop {
    ._pay-pal-button-container {
      max-width: 50%;
      justify-content: flex-start;
    }
  }
}
</style>
