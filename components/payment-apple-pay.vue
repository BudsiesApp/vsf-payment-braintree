<template>
  <div class="checkout-apple-pay" v-if="!!applePayCheckoutInstance">
    <slot />
  </div>
</template>

<script lang="ts">
import config from 'config'
import braintree, { ApplePay } from 'braintree-web';

import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_DATA, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import supportedMethodsCodes from '../types/SupportedMethodsCodes';

let ApplePaySession: any;

export default PaymentMethod.extend({
  name: 'PaymentApplePay',
  data () {
    return {
      applePayCheckoutInstance: undefined as undefined | ApplePay
    }
  },
  async created (): Promise<void> {
    if (!this.isApplePayAvailable() || !this.braintreeClient) {
      return;
    }

    this.createApplePayCheckoutInstance(this.braintreeClient);
  },
  methods: {
    async createApplePayCheckoutInstance (braintreeClient: braintree.Client): Promise<void> {
      if (this.applePayCheckoutInstance) {
        return;
      }

      try {
        this.applePayCheckoutInstance = await braintree.applePay.create({ client: braintreeClient });
      } catch (error) {
        this.$emit('error', error);
      }
    },
    doPayment () {
      if (!this.applePayCheckoutInstance) {
        throw new Error('ApplePay instance is undefined');
      }

      const paymentRequest = this.applePayCheckoutInstance.createPaymentRequest({
        total: {
          label: config.braintree.applePay.label,
          amount: this.total.toString(10)
        },

        requiredBillingContactFields: ['postalAddress']
      });

      const session = new ApplePaySession(3, paymentRequest);

      session.onvalidatemerchant = (event: any) => this.onValidateMerchant(event, session);
      session.onpaymentauthorized = (event: any) => this.onPaymentAuthorized(event, session);
      session.begin();
    },
    isApplePayAvailable (): boolean {
      ApplePaySession = (this.window as any).ApplePaySession;

      if (!ApplePaySession ||
     !ApplePaySession.canMakePayments()
      ) {
        return false;
      }

      return true;
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

        this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_DATA}`, {
          payment_method_nonce: payload.nonce,
          budsies_payment_method_code: supportedMethodsCodes.APPLE_PAY
        });

        this.$emit('success');
        session.completePayment(ApplePaySession.STATUS_SUCCESS);
      } catch (error) {
        session.completePayment(ApplePaySession.STATUS_FAILURE);
      }
    }
  },
  watch: {
    braintreeClient: {
      handler (val) {
        if (!val || !this.isApplePayAvailable()) {
          return;
        }

        this.createApplePayCheckoutInstance(val);
      }
    }
  }
})
</script>
