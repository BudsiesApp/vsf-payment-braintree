<template>
  <div class="payment-pay-pal">
    <slot />

    <div
      class="_pay-pal-button-container"
      id="pay-pal-button-container"
      v-show="showContent"
    />
  </div>
</template>

<script lang="ts">
import paypalCheckout, { PayPalCheckout, PayPalCheckoutTokenizationOptions } from 'braintree-web/dist/browser/paypal-checkout';

import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import { PAYMENT_ERROR_EVENT } from 'src/modules/shared';

enum FlowType {
  Vault = 'vault',
  Checkout = 'checkout'
}

enum Intent {
  Authorize = 'authorize',
  Order = 'order',
  Capture = 'capture'
}

export default PaymentMethod.extend({
  name: 'PaymentPayPal',
  data () {
    return {
      paypalCheckoutInstance: undefined as braintree.PayPalCheckout | undefined
    }
  },
  created (): void {
    if (!this.braintreeClient) {
      return;
    }

    this.createPaypalCheckoutInstance(this.braintreeClient);
  },
  methods: {
    async createPaypalCheckoutInstance (braintreeClient: braintree.Client): Promise<void> {
      if (this.paypalCheckoutInstance) {
        return;
      }

      try {
        this.paypalCheckoutInstance = await paypalCheckout.create({
          client: braintreeClient
        });

        await this.paypalCheckoutInstance.loadPayPalSDK({
          currency: this.currency,
          intent: 'capture'
        });

        await this.onPayPalSdkLoaded(this.paypalCheckoutInstance);
      } catch (error) {
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    },
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
              EventBus.$emit(PAYMENT_ERROR_EVENT);
              return;
            }

            this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, payload.nonce);

            this.$emit('success');
          })
        },
        onError: (_error: string) => {
          EventBus.$emit(PAYMENT_ERROR_EVENT);
        }
      });

      buttons.render('#pay-pal-button-container');
    }
  },
  watch: {
    braintreeClient: {
      handler (val) {
        if (!val) {
          return;
        }

        this.createPaypalCheckoutInstance(val);
      }
    }
  }
})
</script>

<style lang="scss" scoped>
@import '~@storefront-ui/shared/styles/helpers/breakpoints';

.payment-pay-pal {
  ._pay-pal-button-container {
      display: flex;
      margin: var(--spacer-sm) 0;
      justify-content: center;
      align-items: center;
      padding: 0;
  }

  @include for-desktop {
    ._pay-pal-button-container {
      max-width: 50%;
      justify-content: flex-start;
      margin-left: calc(var(--spacer-xl) + var(--spacer-sm));
    }
  }
}
</style>
