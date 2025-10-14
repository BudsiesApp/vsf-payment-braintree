<template>
  <div class="payment-google-pay" v-if="!!googlePayCheckoutInstance && isGooglePayAvailable">
    <slot>
      <div ref="buttonContainer" />
    </slot>
  </div>
</template>

<script lang="ts">
import { VueConstructor } from 'vue';
import googlePayment, { GooglePayment } from 'braintree-web/dist/browser/google-payment';
import loadScript from '@braintree/asset-loader/dist/load-script';

import config from 'config';
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus';
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import { ExpressCheckoutData, getFirstAndLastFromFullName, getRegionIdByCountryAndStateCode, PAYMENT_ERROR_EVENT, DEFAULT_CURRENCY_CODE } from 'src/modules/shared';
import supportedMethodsCodes from '../types/SupportedMethodsCodes';
import { Logger } from '@vue-storefront/core/lib/logger';

type AdditionalAddressData = ExpressCheckoutData.AdditionalAddressData;
type ExpressCheckoutAuthorizedCallbackData = ExpressCheckoutData.ExpressCheckoutAuthorizedCallbackData<supportedMethodsCodes>;
type MainAddressData = ExpressCheckoutData.MainAddressData;
type ShippingDetailsChangedCallbackData = ExpressCheckoutData.ShippingDetailsChangedCallbackData

const googlePaySource = 'https://pay.google.com/gp/p/js/pay.js';
const googlePayScriptId = 'braintree-dropin-google-payment-script';

const BRAINTREE_SANDBOX_CODE = 'sandbox';
const ABORT_PAYMENT_ERROR_NAME = 'AbortError';

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

interface StaticData {
  googlePayClient: undefined | google.payments.api.PaymentsClient
}

export default (PaymentMethod as VueConstructor<InstanceType<typeof PaymentMethod> & StaticData>).extend({
  name: 'PaymentGooglePay',
  data () {
    return {
      googlePayCheckoutInstance: undefined as undefined | GooglePayment,
      isGooglePayAvailable: false
    }
  },
  computed: {
    expressCheckoutPaymentRequestData (): Partial<google.payments.api.PaymentDataRequest> {
      const isShippingOptionRequired = !this.$store.getters['cart/isVirtualCart'];
      const callbackIntents: google.payments.api.CallbackIntent[] = ['SHIPPING_ADDRESS', 'PAYMENT_AUTHORIZATION']

      if (isShippingOptionRequired) {
        callbackIntents.push('SHIPPING_OPTION');
      }

      return {
        emailRequired: true,
        shippingAddressRequired: true,
        shippingAddressParameters: {
          phoneNumberRequired: true
        } as any,
        shippingOptionRequired: isShippingOptionRequired,
        callbackIntents
      };
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

      const { firstName, lastName } = getFirstAndLastFromFullName(paymentData.shippingAddress.name);

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
          currencyCode: DEFAULT_CURRENCY_CODE
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

      const environment = this.getEnvironment();
      const merchantId = config.braintree.googlePay.merchantId;

      if ((environment !== 'TEST' && !merchantId) || !this.window.google) {
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

      this.googlePayClient = new this.window.google.payments.api.PaymentsClient(options);

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
        Logger.error('Checkout instance creation error: ' + error, 'google-pay')();
        this.isGooglePayAvailable = false;
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    },
    async doPayment () {
      if (!this.googlePayCheckoutInstance) {
        throw new Error('GooglePay instance is undefined');
      }

      if (!this.googlePayClient) {
        throw new Error('GooglePay client is undefined');
      }

      this.$emit('payment-started');

      try {
        let paymentRequest = await this.googlePayCheckoutInstance.createPaymentDataRequest({
          transactionInfo: {
            currencyCode: DEFAULT_CURRENCY_CODE,
            totalPriceStatus: 'FINAL',
            totalPrice: this.total.toString(10)
          }
        });

        if (this.isExpressCheckout) {
          paymentRequest = { ...paymentRequest, ...this.expressCheckoutPaymentRequestData };
        }

        var paymentData = await this.googlePayClient.loadPaymentData(paymentRequest);

        var tokenizePayload = await this.googlePayCheckoutInstance.parseResponse(paymentData);

        this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, tokenizePayload.nonce);

        this.$emit('success');
      } catch (error) {
        if ((error as any).name === ABORT_PAYMENT_ERROR_NAME) {
          return;
        }

        Logger.error('Error during payment processing: ' + error, 'google-pay')();
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
      handler (value) {
        if (!value) {
          return;
        }

        this.createExpressCheckoutButton();
      }
    }

  }
})
</script>
