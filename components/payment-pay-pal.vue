<template>
  <div class="payment-pay-pal" :class="{'-express-checkout': isExpressCheckout}">
    <slot />

    <div
      class="_pay-pal-button-container"
      id="pay-pal-button-container"
      v-show="showPayPalButtonContainer"
    />
  </div>
</template>

<script lang="ts">
import { PayPalCheckoutCreatePaymentOptions } from 'braintree-web';
import paypalCheckout, { PayPalCheckoutTokenizationOptions, ShippingOptionType } from 'braintree-web/dist/browser/paypal-checkout';

import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import {
  ExpressCheckoutData,
  getFirstAndLastFromFullName,
  getRegionIdByCountryAndStateCode,
  PAYMENT_ERROR_EVENT,
  DEFAULT_CURRENCY_CODE
} from 'src/modules/shared';

import { Logger } from '@vue-storefront/core/lib/logger';

import supportedMethodsCodes from '../types/SupportedMethodsCodes';

type AdditionalAddressData = ExpressCheckoutData.AdditionalAddressData;
type MainAddressData = ExpressCheckoutData.MainAddressData;

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
  props: {
    isOrderPlacementDisabled: {
      type: Boolean,
      default: false
    }
  },
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
  computed: {
    showPayPalButtonContainer (): boolean {
      return this.showContent && !this.isOrderPlacementDisabled;
    }
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

        await this.onPayPalSdkLoaded();
      } catch (error) {
        Logger.error('Checkout instance creation error: ' + error, 'pay-pal')();
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    },
    async onPayPalSdkLoaded (): Promise<void> {
      const paypal = (this.window as any).paypal;
      if (!paypal) {
        return;
      }

      const buttons = await paypal.Buttons({
        onShippingChange: this.onPayPalShippingChange,
        fundingSource: paypal.FUNDING.PAYPAL,
        style: {
          label: this.isExpressCheckout ? 'checkout' : 'pay',
          color: 'blue',
          height: 40,
          disableMaxWidth: true
        },
        createOrder: this.onPayPalCreateOrder,
        onApprove: this.onPayPalApprove,
        onError: this.onPayPalError
      });

      buttons.render('#pay-pal-button-container');
    },
    async onPayPalShippingChange (data: any, actions: any) {
      if (!this.isExpressCheckout) {
        return actions.resolve();
      }

      if (!this.paypalCheckoutInstance) {
        throw new Error('paypalCheckoutInstance is not defined');
      }

      if (!this.onShippingDetailsChanged) {
        throw new Error('onShippingDetailsChanged is not defined')
      }

      const shippingOption = data.selected_shipping_option;

      const regionId = getRegionIdByCountryAndStateCode(
        data.shipping_address.country_code,
        data.shipping_address.state
      );

      const state = regionId === null ? data.shipping_address.state : '';

      const shippingAddressData: MainAddressData = {
        country: data.shipping_address.country_code,
        state,
        city: data.shipping_address.city,
        region_id: regionId,
        zipCode: data.shipping_address.postal_code
      }

      const result = await this.onShippingDetailsChanged({
        shippingMethod: shippingOption?.id,
        shippingAddress: shippingAddressData,
        paymentAddress: shippingAddressData
      });

      const convertedShippingOptions: paypal.ShippingOption[] = [];

      for (const method of result.availableShippingMethods) {
        if (!method.method_code || !method.carrier_code || method.price_incl_tax === undefined) {
          continue;
        }

        convertedShippingOptions.push({
          id: method.method_code,
          type: 'SHIPPING' as ShippingOptionType,
          label: method.method_title?.toString() || method.method_code,
          selected: method.method_code === result.selectedShippingMethod,
          amount: {
            currency: DEFAULT_CURRENCY_CODE,
            value: method.price_incl_tax.toString()
          }
        });
      }

      return this.paypalCheckoutInstance.updatePayment({
        paymentId: data.paymentId,
        amount: result.total.final.toString(),
        currency: DEFAULT_CURRENCY_CODE,
        shippingOptions: convertedShippingOptions
      });
    },
    onPayPalCreateOrder (): Promise<string> {
      if (!this.paypalCheckoutInstance) {
        throw new Error('paypalCheckoutInstance is not defined')
      }

      const paymentData: PayPalCheckoutCreatePaymentOptions = {
        flow: FlowType.Checkout,
        amount: this.total,
        currency: this.currency,
        intent: Intent.Capture
      };

      if (this.isExpressCheckout) {
        paymentData.enableShippingAddress = true;
        paymentData.shippingOptions = [];
      }

      this.$emit('payment-started');

      return this.paypalCheckoutInstance.createPayment(paymentData);
    },
    async onPayPalApprove (data: PayPalCheckoutTokenizationOptions): Promise<void> {
      if (!this.paypalCheckoutInstance) {
        throw new Error('paypalCheckoutInstance is not defined')
      }

      try {
        const tokenizeResult = await this.paypalCheckoutInstance.tokenizePayment(data);
        this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, tokenizeResult.nonce);

        if (!this.isExpressCheckout) {
          this.$emit('success');
          return;
        }

        if (!this.onExpressCheckoutAuthorized) {
          throw new Error('onExpressCheckoutAuthorized is not defined');
        }

        const details = tokenizeResult.details;

        if (!details.shippingAddress) {
          throw new Error('Shipping address is not specified');
        }

        if (!details.shippingAddress.recipientName) {
          throw new Error('Recipient name is not specified');
        }

        const { firstName, lastName } = getFirstAndLastFromFullName(details.shippingAddress.recipientName);

        const addressData: AdditionalAddressData = {
          firstName,
          lastName,
          streetAddress: details.shippingAddress?.line1 || ''
        };

        await this.onExpressCheckoutAuthorized(
          {
            paymentMethod: supportedMethodsCodes.PAY_PAL,
            customer: {
              firstName: details.firstName,
              lastName: details.lastName,
              emailAddress: details.email
            },
            shippingDetails: addressData,
            paymentDetails: addressData
          }
        );

        this.$emit('success');
      } catch (error) {
        Logger.error('Error during payment authorization: ' + error, 'pay-pal')();
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    },
    onPayPalError (): void {
      Logger.error('Error during payment processing', 'pay-pal')();
      EventBus.$emit(PAYMENT_ERROR_EVENT);
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

  &.-express-checkout {
    ._pay-pal-button-container {
      max-width: 100%;
      margin: 0;
    }
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
