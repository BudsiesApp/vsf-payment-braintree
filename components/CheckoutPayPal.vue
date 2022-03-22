<template>
  <div class="checkout-paypal">
    <slot name="title" />

    <div id="paypal-button" class="_button" v-show="isSelected" />
  </div>
</template>

<script lang="ts">
import braintree, { PayPalCheckout } from 'braintree-web';
import { PayPalCheckoutTokenizationOptions } from 'braintree-web/modules/paypal-checkout';
import Vue, { PropType, VueConstructor } from 'vue';

import { InjectType } from 'src/modules/shared';

import TransactionData from '../types/transaction-data';

interface InjectedServices {
  window: Window
}

enum FlowType {
  Vault = 'vault',
  Checkout = 'checkout'
}

enum Intent {
  Authorize = 'authorize',
  Order = 'order',
  Capture = 'capture'
}

export default (Vue as VueConstructor<Vue & InjectedServices>).extend({
  name: 'CheckoutPayPal',
  inject: {
    window: { from: 'WindowObject' }
  } as unknown as InjectType<InjectedServices>,
  props: {
    braintreeClient: {
      type: Object as PropType<braintree.Client>,
      required: true
    },
    transaction: {
      type: Object as PropType<TransactionData>,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    }
  },
  async created (): Promise<void> {
    try {
      const paypalCheckoutInstance = await braintree.paypalCheckout.create({
        client: this.braintreeClient
      });

      await paypalCheckoutInstance.loadPayPalSDK({
        currency: this.transaction.currency,
        intent: 'capture'
      });

      await this.onPayPalSdkLoaded(paypalCheckoutInstance);
    } catch (error) {
      this.$emit('error', error);
    }
  },
  methods: {
    onPayPalSdkLoaded (paypalCheckoutInstance: PayPalCheckout): void {
      const paypal = (this.window as any).paypal;
      if (!paypal) {
        return;
      }

      paypal.Buttons({
        fundingSource: paypal.FUNDING.PAYPAL,
        createOrder: () => {
          return paypalCheckoutInstance.createPayment({
            flow: FlowType.Checkout,
            amount: this.transaction.total,
            currency: this.transaction.currency,
            intent: Intent.Capture
          });
        },
        onApprove: (data: PayPalCheckoutTokenizationOptions) => {
          return paypalCheckoutInstance.tokenizePayment(data, (error, payload) => {
            if (error) {
              this.$emit('error', error);
              return;
            }

            this.$emit('success', payload);
          })
        },
        onError: (error: string) => {
          this.$emit('error', error)
        }
      }).render('#paypal-button');
    }
  }
})
</script>

<style lang="scss" scoped>
.checkout-paypal {
  ._button {
    margin: var(--spacer-sm) var(--spacer-sm) 0;
  }
}
</style>
