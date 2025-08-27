<template>
  <div class="payment-google-pay" v-if="!!googlePayCheckoutInstance && isGooglePayAvailable">
    <slot>
      <div ref="buttonContainer" />
    </slot>
  </div>
</template>

<script lang="ts">
import googlePayment, { GooglePayment } from 'braintree-web/dist/browser/google-payment';
import loadScript from '@braintree/asset-loader/dist/load-script';

import config from 'config';
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus';
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import { getRegionIdByCountryAndStateCode, PAYMENT_ERROR_EVENT } from 'src/modules/shared';
import { AdditionalAddressData, ExpressCheckoutAuthorizedCallbackData, MainAddressData, ShippingDetailsChangedCallbackData } from '../types/express-checkout-data.interface';
import supportedMethodsCodes from '../types/SupportedMethodsCodes';

const googlePaySource = 'https://pay.google.com/gp/p/js/pay.js';
const googlePayScriptId = 'braintree-dropin-google-payment-script';

const BRAINTREE_SANDBOX_CODE = 'sandbox';

function getErrorObject (errorMessage: string): google.payments.api.PaymentAuthorizationResult {
  return {
    error: {
      reason: 'SHIPPING_ADDRESS_INVALID',
      intent: 'SHIPPING_ADDRESS',
      message: errorMessage
    },
    transactionState: 'ERROR'
  };
}

export default PaymentMethod.extend({
  name: 'PaymentGooglePay',
  data () {
    const expressCheckoutPaymentRequestData: Partial<google.payments.api.PaymentDataRequest> = {
      emailRequired: true,
      shippingAddressRequired: true,
      shippingAddressParameters: {
        phoneNumberRequired: true
      } as any,
      shippingOptionRequired: true,
      callbackIntents: ['SHIPPING_ADDRESS', 'SHIPPING_OPTION', 'PAYMENT_AUTHORIZATION']
    };

    return {
      googlePayClient: undefined as undefined | any,
      googlePayCheckoutInstance: undefined as undefined | GooglePayment,
      isGooglePayAvailable: false,
      expressCheckoutPaymentRequestData
    }
  },
  async created (): Promise<void> {
    if (!this.braintreeClient) {
      return;
    }

    this.createGooglePayCheckoutInstance(this.braintreeClient);
  },
  methods: {
    async onPaymentAuthorized (paymentData: any): Promise<google.payments.api.PaymentAuthorizationResult> {
      if (!paymentData.shippingAddress) {
        return Promise.resolve(getErrorObject('Please, provide shipping address'));
      }

      if (!paymentData.shippingAddress.name) {
        return Promise.resolve(getErrorObject('Please, provide recepient name'));
      }

      if (!paymentData.email) {
        return Promise.resolve(getErrorObject('Please, provide e-mail address'));
      }

      const [firstName, lastName] = paymentData.shippingAddress.name.split(' ');

      const customer: ExpressCheckoutAuthorizedCallbackData['customer'] = {
        emailAddress: paymentData.email,
        firstName,
        lastName
      };

      const shippingAddress = paymentData.shippingAddress;

      const additionalAddressData: AdditionalAddressData = {
        firstName,
        lastName,
        streetAddress: shippingAddress.address1 || '',
        phoneNumber: shippingAddress.phoneNumber || ''
      };

      if (!this.onExpressCheckoutAuthorized) {
        throw new Error('onExpressCheckoutAuthorized is missing');
      }

      await this.onExpressCheckoutAuthorized({
        paymentMethod: supportedMethodsCodes.GOOGLE_PAY,
        customer,
        shippingDetails: additionalAddressData,
        paymentDetails: additionalAddressData
      });

      return Promise.resolve({ transactionState: 'SUCCESS' });
    },
    async onPaymentDataChanged (intermediatePaymentData: any): Promise<any> {
      const shippingOptionId = intermediatePaymentData.shippingOptionData?.id;

      const shippingAddress = intermediatePaymentData.shippingAddress;

      if (!shippingAddress) {
        return Promise.resolve({});
      }

      const regionId = getRegionIdByCountryAndStateCode(
        shippingAddress.countryCode,
        shippingAddress.administrativeArea
      );

      const state = regionId === null ? shippingAddress.administrativeArea : '';

      const addressData: MainAddressData = {
        country: shippingAddress.countryCode,
        city: shippingAddress.locality,
        state,
        region_id: regionId,
        zipCode: shippingAddress.postalCode
      };

      const shippingDetails: ShippingDetailsChangedCallbackData = {
        shippingAddress: addressData,
        paymentAddress: addressData,
        shippingMethod: shippingOptionId && shippingOptionId !== 'shipping_option_unselected' ? shippingOptionId : ''
      };

      if (!this.onShippingDetailsChanged) {
        return Promise.resolve({});
      }

      const result = await this.onShippingDetailsChanged(shippingDetails);
      const convertedShippingOptions: google.payments.api.SelectionOption[] = [];

      for (const item of result.availableShippingMethods) {
        if (!item.method_code || !item.method_title) {
          continue;
        }

        const price = item.price_incl_tax?.toString();
        convertedShippingOptions.push({
          id: item.method_code,
          label: item.method_title,
          description: price ? `$${price}` : ''
        });
      }

      return Promise.resolve({
        newTransactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: result.total.final.toString(),
          currencyCode: 'USD'
        },
        newShippingOptionParameters: {
          shippingOptions: convertedShippingOptions,
          defaultSelectedOptionId: result.selectedShippingMethod
        }
      });
    },
    async createExpressCheckoutButton (): Promise<void> {
      if (!this.googlePayClient || !this.isExpressCheckout || !this.isGooglePayAvailable) {
        return;
      }

      const doPayment = this.doPayment.bind(this);

      const button = this.googlePayClient.createButton({
        onClick: doPayment,
        buttonType: 'checkout',
        buttonSizeMode: 'fill'
      });

      await this.$nextTick();

      (this.$refs.buttonContainer as HTMLElement).appendChild(button);
    },
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

      let options: google.payments.api.PaymentOptions = { environment };

      if (this.isExpressCheckout) {
        options = {
          environment,
          paymentDataCallbacks: {
            onPaymentAuthorized: this.onPaymentAuthorized,
            onPaymentDataChanged: this.onPaymentDataChanged
          }
        }
      }

      this.googlePayClient = new google.payments.api.PaymentsClient(options);

      if (this.googlePayCheckoutInstance) {
        return;
      }

      try {
        this.googlePayCheckoutInstance = await googlePayment.create({
          client: braintreeClient,
          googlePayVersion: 2,
          googleMerchantId: merchantId
        });

        const isReadyToPay = await this.googlePayClient.isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: this.googlePayCheckoutInstance.createPaymentDataRequest().allowedPaymentMethods
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
        let paymentRequest = await this.googlePayCheckoutInstance.createPaymentDataRequest({
          transactionInfo: {
            currencyCode: 'USD',
            totalPriceStatus: 'FINAL',
            totalPrice: this.total.toString(10)
          }
        });

        if (this.isExpressCheckout) {
          paymentRequest = { ...paymentRequest, ...this.expressCheckoutPaymentRequestData };
        }

        var paymentData = await this.googlePayClient.loadPaymentData(paymentRequest);

        var tokenizePayload = await this.googlePayCheckoutInstance.parseResponse(paymentData);

        tokenizePayload.rawPaymentData = paymentData

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
    },
    isGooglePayAvailable: {
      handler () {
        this.createExpressCheckoutButton();
      }
    }

  }
})
</script>
