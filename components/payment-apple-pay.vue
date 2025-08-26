<template>
  <div class="payment-apple-pay" v-if="!!applePayCheckoutInstance">
    <slot>
      <apple-pay-button
        buttonstyle="black"
        type="check-out"
        ref="buttonContainer"
        class="_express-checkout-button"
        v-if="isExpressCheckout"
        @click="doPayment"
      />
    </slot>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import config from 'config'
import applePay, { ApplePay } from 'braintree-web/dist/browser/apple-pay';

import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';
import { PAYMENT_ERROR_EVENT, getRegionIdByCountryAndStateCode } from 'src/modules/shared';

import supportedMethodsCodes from '../types/SupportedMethodsCodes';
import { AdditionalAddressData, ExpressCheckoutAuthorizedCallbackData, MainAddressData, ShippingDetailsChangedCallbackData } from '../types/express-checkout-data.interface';

let ApplePaySession: any;

Vue.config.ignoredElements = [...(Vue.config.ignoredElements || []), 'apple-pay-button'];

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
    prepareAddressDataFromAppleContact (contact: any): MainAddressData {
      const countryCode: string = contact?.countryCode || '';
      const adminArea: string = contact?.administrativeArea || '';
      const regionId = getRegionIdByCountryAndStateCode(countryCode, adminArea);

      return {
        country: countryCode,
        city: contact?.locality || '',
        state: regionId === null ? adminArea : '',
        region_id: regionId,
        zipCode: contact?.postalCode || ''
      };
    },
    async createApplePayCheckoutInstance (braintreeClient: braintree.Client): Promise<void> {
      if (this.applePayCheckoutInstance) {
        return;
      }

      try {
        this.applePayCheckoutInstance = await applePay.create({ client: braintreeClient });
      } catch (error) {
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    },
    doPayment () {
      if (!this.applePayCheckoutInstance) {
        throw new Error('ApplePay instance is undefined');
      }

      const paymentRequest: any = this.applePayCheckoutInstance.createPaymentRequest({
        total: {
          label: config.braintree.applePay.label,
          amount: this.total.toString(10)
        }
      });

      if (this.isExpressCheckout) {
        paymentRequest.requiredBillingContactFields = [
          'postalAddress',
          'name',
          'phone',
          'email'
        ];
        paymentRequest.requiredShippingContactFields = [
          'postalAddress',
          'name',
          'phone',
          'email',
        ];
      }

      const session = new ApplePaySession(3, paymentRequest);

      session.onshippingcontactselected = async (event: any) => {
        try {
          if (!this.onShippingDetailsChanged) {
            session.completeShippingContactSelection({
              newShippingMethods: [],
              newTotal: { label: config.braintree.applePay.label, amount: this.total.toString(10) },
              newLineItems: []
            });
            return;
          }

          const shippingContact = event.shippingContact || {};
          const billingContact = event.billingContact || event.payment?.billingContact || null;

          const shippingAddress = this.prepareAddressDataFromAppleContact(shippingContact);
          const paymentAddress = billingContact ? this.prepareAddressDataFromAppleContact(billingContact) : shippingAddress;

          const shippingDetails: ShippingDetailsChangedCallbackData = {
            shippingAddress,
            paymentAddress,
            shippingMethod: ''
          };

          const result = await this.onShippingDetailsChanged(shippingDetails);

          const newShippingMethods = (result.availableShippingMethods || [])
            .filter((m: any) => m.method_code && m.method_title)
            .map((m: any) => ({
              identifier: m.method_code,
              label: m.method_title,
              detail: m.price_incl_tax ? `$${m.price_incl_tax}` : '',
              amount: (m.price_incl_tax ?? 0).toString()
            }));

          session.completeShippingContactSelection({
            newShippingMethods,
            newTotal: { label: config.braintree.applePay.label, amount: result.total.final.toString() },
            newLineItems: []
          });
        } catch (e) {
          EventBus.$emit(PAYMENT_ERROR_EVENT);
        }
      };

      session.onshippingmethodselected = async (event: any) => {
        try {
          if (!this.onShippingDetailsChanged) {
            session.completeShippingMethodSelection({
              newTotal: { label: config.braintree.applePay.label, amount: this.total.toString(10) },
              newLineItems: []
            });
            return;
          }

          const methodId: string = event.shippingMethod && event.shippingMethod.identifier ? event.shippingMethod.identifier : '';

          const shippingDetails: ShippingDetailsChangedCallbackData = {
            shippingMethod: methodId
          };

          const result = await this.onShippingDetailsChanged(shippingDetails);

          session.completeShippingMethodSelection({
            newTotal: { label: config.braintree.applePay.label, amount: result.total.final.toString() },
            newLineItems: []
          });
        } catch (e) {
          EventBus.$emit(PAYMENT_ERROR_EVENT);
        }
      };

      session.onvalidatemerchant = (event: any) => this.onValidateMerchant(event, session);
      session.onpaymentauthorized = (event: any) => this.onPaymentAuthorized(event, session);
      session.begin();
    },
    isApplePayAvailable (): boolean {
      ApplePaySession = (this.window as any).ApplePaySession;

      return ApplePaySession && ApplePaySession.canMakePayments();
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
        EventBus.$emit(PAYMENT_ERROR_EVENT);
      }
    },
    async onPaymentAuthorized (event: any, session: any): Promise<void> {
      if (!this.applePayCheckoutInstance) {
        return;
      }

      try {
        if (this.isExpressCheckout) {
          if (!this.onExpressCheckoutAuthorized) {
            throw new Error('onExpressCheckoutAuthorized is missing');
          }

          const shippingContact = event.payment?.shippingContact || {};

          const firstName: string = shippingContact.givenName || '';
          const lastName: string = shippingContact.familyName || '';
          const emailAddress: string = shippingContact.emailAddress || '';

          const customer: ExpressCheckoutAuthorizedCallbackData['customer'] = {
            emailAddress,
            firstName,
            lastName
          };

          const streetAddress = Array.isArray(shippingContact.addressLines)
            ? shippingContact.addressLines.join(' ')
            : (shippingContact.addressLines || '');

          const additionalAddressData: AdditionalAddressData = {
            firstName,
            lastName,
            streetAddress: streetAddress || '',
            phoneNumber: shippingContact.phoneNumber || ''
          };

          await this.onExpressCheckoutAuthorized({
            paymentMethod: supportedMethodsCodes.APPLE_PAY,
            customer,
            shippingDetails: additionalAddressData,
            paymentDetails: additionalAddressData
          });
        }

        const payload = await this.applePayCheckoutInstance.tokenize({
          token: event.payment.token
        });

        this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, payload.nonce);

        this.$emit('success');
        session.completePayment(ApplePaySession.STATUS_SUCCESS);
      } catch (error) {
        session.completePayment(ApplePaySession.STATUS_FAILURE);
        EventBus.$emit(PAYMENT_ERROR_EVENT);
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

<style lang="scss" scoped>
.payment-apple-pay {
  ._express-checkout-button {
    --apple-pay-button-width: 100%;
    --apple-pay-button-height: 40px;
  }
}
</style>
