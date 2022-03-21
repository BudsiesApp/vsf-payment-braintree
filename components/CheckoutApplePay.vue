<template>
  <div class="checkout-apple-pay" v-if="!!applePayCheckoutInstance">
    <slot name="title" v-bind="{isSelected}" />

    <div class="_apple-pay" v-if="showPaymentMethodContent" @click="onApplePayButtonClick" />
  </div>
</template>

<script lang="ts">
import config from 'config'
import braintree, { ApplePay } from 'braintree-web';
import Vue, { PropType, VueConstructor } from 'vue';

import { InjectType } from 'src/modules/shared';

import TransactionData from '../types/transaction-data';

interface InjectedServices {
  window: Window
}

export default (Vue as VueConstructor<Vue & InjectedServices>).extend({
  name: 'CheckoutApplePay',
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
  data () {
    return {
      applePayCheckoutInstance: undefined as undefined | ApplePay
    }
  },
  computed: {
    showPaymentMethodContent (): boolean {
      return this.isSelected && !!this.applePayCheckoutInstance;
    }
  },
  async created (): Promise<void> {
    if (!(this.window as any).ApplePaySession ||
     !(this.window as any).ApplePaySession.canMakePayments()
    ) {
      return;
    }

    try {
      this.applePayCheckoutInstance = await braintree.applePay.create({ client: this.braintreeClient });
    } catch (error) {
      this.$emit('error', error);
    }
  },
  methods: {
    onApplePayButtonClick () {
      if (!this.applePayCheckoutInstance) {
        throw new Error('ApplePay instance is undefined');
      }

      const paymentRequest = this.applePayCheckoutInstance.createPaymentRequest({
        total: {
          label: config.braintree.applePay.label,
          amount: this.transaction.total.toString(10)
        },

        requiredBillingContactFields: ['postalAddress']
      });

      const session = new (this.window as any).ApplePaySession(3, paymentRequest);

      session.onvalidatemerchant = (event: any) => this.onValidateMerchant(event, session);
      session.onpaymentauthorized = (event: any) => this.onPaymentAuthorized(event, session);
      session.begin();
    },
    async onValidateMerchant (event: any, session: any): Promise<void> {
      if (!this.applePayCheckoutInstance) {
        throw new Error('ApplePay instance is undefined');
      }

      try {
        const merchantSession = await this.applePayCheckoutInstance.performValidation({
          validationURL: event.validationURL,
          displayName: config.braintree.applePay.displayName
        });

        session.completeMerchantValidation(merchantSession);
      } catch (error) {
        this.$emit('error', error)
      }
    },
    async onPaymentAuthorized (event: any, session: any): Promise<void> {
      if (!this.applePayCheckoutInstance) {
        return;
      }

      try {
        const payload = await this.applePayCheckoutInstance.tokenize({
          token: event.payment.token
        });

        this.$emit('success', payload);
        session.completePayment((this.window as any).ApplePaySession.STATUS_SUCCESS);
      } catch (error) {
        session.completePayment((this.window as any).ApplePaySession.STATUS_FAILURE);
      }
    }
  }
})
</script>

<style lang="scss" scoped>
.checkout-apple-pay {
  ._apple-pay {
    margin-top: var(--spacer-sm);
  }

  @supports not (-webkit-appearance: -apple-pay-button) {
    ._apple-pay {
      display: inline-block;
      background-size: 100% 60%;
      background-repeat: no-repeat;
      background-position: 50% 50%;
      border-radius: 5px;
      padding: 0px;
      box-sizing: border-box;
      min-width: 200px;
      min-height: 32px;
      max-height: 64px;
      background-image: -webkit-named-image(apple-pay-logo-white);
      background-color: black;
    }
  }

  @supports (-webkit-appearance: -apple-pay-button) {
    ._apple-pay {
      display: inline-block;
      -webkit-appearance: -apple-pay-button;
      -apple-pay-button-type: plain;
    }
  }
}
</style>
