<template>
  <div class="payment-google-pay" v-if="!!googlePayCheckoutInstance && isGooglePayAvailable">
    <slot />
  </div>
</template>

<script lang="ts">
import googlePayment, { GooglePayment } from 'braintree-web/dist/browser/google-payment';
import loadScript from '@braintree/asset-loader/load-script';

import config from 'config';
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus';
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import { PAYMENT_ERROR_EVENT } from 'src/modules/shared';

const googlePaySource = 'https://pay.google.com/gp/p/js/pay.js';
const googlePayScriptId = 'braintree-dropin-google-payment-script';

const BRAINTREE_SANDBOX_CODE = 'sandbox';

export default PaymentMethod.extend({
  name: 'PaymentGooglePay',
  data () {
    return {
      googlePayClient: undefined as undefined | any,
      googlePayCheckoutInstance: undefined as undefined | GooglePayment,
      isGooglePayAvailable: false
    }
  },
  async created (): Promise<void> {
    if (!this.braintreeClient) {
      return;
    }

    this.createGooglePayCheckoutInstance(this.braintreeClient);
  },
  methods: {
    getEnvironment (): 'TEST' | 'PRODUCTION' {
      if (!this.braintreeClient) {
        return 'TEST';
      }

      const environment = this.braintreeClient.getConfiguration().gatewayConfiguration.androidPay.environment;

      return environment === BRAINTREE_SANDBOX_CODE ? 'TEST' : 'PRODUCTION';
    },
    async createGooglePayCheckoutInstance (braintreeClient: braintree.Client): Promise<void> {
      if (this.googlePayClient) {
        return;
      }

      await loadScript({
        id: googlePayScriptId,
        src: googlePaySource
      });

      const google = (this.window as any).google;

      const environment = this.getEnvironment();
      const merchantId = config.braintree.googlePay.merchantId;

      if (environment !== 'TEST' && !merchantId) {
        this.isGooglePayAvailable = false;
        return;
      }

      this.googlePayClient = new google.payments.api.PaymentsClient({
        environment
      });

      if (this.googlePayCheckoutInstance) {
        return;
      }

      try {
        this.googlePayCheckoutInstance = await googlePayment.create({
          client: braintreeClient,
          googlePayVersion: 2,
          googleMerchantId: merchantId
        });

        const paymentDataRequest = await this.googlePayCheckoutInstance.createPaymentDataRequest();

        const isReadyToPay = await this.googlePayClient.isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: paymentDataRequest.allowedPaymentMethods
        });

        this.isGooglePayAvailable = isReadyToPay.result;
      } catch (error) {
        this.isGooglePayAvailable = false;
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    },
    async doPayment () {
      if (!this.googlePayCheckoutInstance) {
        throw new Error('GooglePay instance is undefined');
      }

      try {
        const paymentRequest = await this.googlePayCheckoutInstance.createPaymentDataRequest({
          transactionInfo: {
            currencyCode: 'USD',
            totalPriceStatus: 'FINAL',
            totalPrice: this.total.toString(10)
          }
        });

        var paymentData = await this.googlePayClient.loadPaymentData(paymentRequest);

        var tokenizePayload = await this.googlePayCheckoutInstance.parseResponse(paymentData);

        this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, tokenizePayload.nonce);

        this.$emit('success');
      } catch (error) {
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    }
  },
  watch: {
    braintreeClient: {
      handler (val) {
        if (!val) {
          return;
        }

        this.createGooglePayCheckoutInstance(val);
      }
    }
  }
})
</script>
