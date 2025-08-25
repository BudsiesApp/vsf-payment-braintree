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
import paypalCheckout, { PayPalCheckout, PayPalCheckoutTokenizationOptions, ShippingOptionType } from 'braintree-web/dist/browser/paypal-checkout';

import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import { getRegionIdByCountryAndStateCode, PAYMENT_ERROR_EVENT } from 'src/modules/shared';

import { AdditionalAddressData, MainAddressData } from '../types/express-checkout-data.interface';
import supportedMethodsCodes from '../types/SupportedMethodsCodes';
import { PaymentType } from '../types/payment-type';

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
        onShippingChange: async (data, actions) => {
          if (this.type !== PaymentType.EXPRESS_CHECKOUT) {
            return actions.resolve();
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
            shippingMethod: shippingOption,
            shippingAddress: shippingAddressData,
            paymentAddress: shippingAddressData
          });

          const convertedShippingOptions: {
            id: string,
            type: 'SHIPPING',
            label: string,
            selected: boolean,
            amount: { currency_code: 'USD', value: string }
          }[] = [];

          for (const method of result.availableShippingMethods) {
            if (!method.method_code || !method.carrier_code || method.price_incl_tax === undefined) {
              continue;
            }

            convertedShippingOptions.push({
              id: method.method_code,
              type: 'SHIPPING',
              label: method.method_title?.toString() || method.method_code,
              selected: method.method_code === result.selectedShippingMethod,
              amount: {
                currency_code: 'USD',
                value: method.price_incl_tax.toString()
              }
            });
          }

          await actions.order.patch(
            [
              {
                op: 'replace',
                path: "/purchase_units/@reference_id=='default'/amount",
                value: {
                  currency_code: 'USD',
                  value: result.total.final
                }
              },
              {
                op: 'replace',
                path: "/purchase_units/@reference_id=='default'/shipping/options",
                value: convertedShippingOptions
              }
            ]
          );
          actions.resolve()
        },
        fundingSource: paypal.FUNDING.PAYPAL,
        style: {
          label: this.isExpressCheckout ? 'checkout' : 'pay',
          color: 'blue',
          height: 40,
          disableMaxWidth: true
        },
        createOrder: () => {
          const paymentData: PayPalCheckoutCreatePaymentOptions = {
            flow: FlowType.Checkout,
            amount: this.total,
            currency: this.currency,
            intent: Intent.Capture
          };

          if (this.type === PaymentType.EXPRESS_CHECKOUT) {
            const convertedShippingOptions: {
              id: string,
              type: ShippingOptionType,
              label: string,
              selected: boolean,
              amount: { currency: 'USD', value: string }
            }[] = [];

            for (const method of this.$store.getters['checkout/getShippingMethods']) {
              if (!method.method_code || !method.carrier_code || method.price_incl_tax === undefined) {
                continue;
              }

              convertedShippingOptions.push({
                id: method.method_code,
                type: 'SHIPPING' as ShippingOptionType,
                label: method.method_title?.toString() || method.method_code,
                selected: true,
                amount: {
                  currency: 'USD',
                  value: method.price_incl_tax.toString()
                }
              });
            }

            paymentData.enableShippingAddress = true;
            paymentData.shippingOptions = convertedShippingOptions;
          }

          return paypalCheckoutInstance.createPayment(paymentData);
        },
        onApprove: async (data: PayPalCheckoutTokenizationOptions, actions: any) => {
          if (this.type === PaymentType.EXPRESS_CHECKOUT) {
            const orderData = await actions.order.get();

            const purchaseUnitData = orderData.purchase_units[0];
            const [shippingFirstName, shippingLastName] = purchaseUnitData.shipping.name.full_name.split(' ');
            const shippingAddressData = purchaseUnitData.shipping.address;

            const addressData: AdditionalAddressData = {
              firstName: shippingFirstName,
              lastName: shippingLastName,
              streetAddress: shippingAddressData.address_line_1
            }

            if (!this.onExpressCheckoutAuthorized) {
              throw new Error('onExpressCheckoutAuthorized is not defined');
            }

            await this.onExpressCheckoutAuthorized(
              {
                paymentMethod: supportedMethodsCodes.PAY_PAL,
                customer: {
                  firstName: orderData.payer.name.given_name,
                  lastName: orderData.payer.name.surname,
                  emailAddress: orderData.payer.email_address
                },
                shippingDetails: addressData,
                paymentDetails: addressData
              }
            );
          }

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
