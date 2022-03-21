<template>
  <div class="braintree-client">
    <template v-if="!!braintreeClient">
      <div class="_list" v-for="method in braintreePaymentMethods" :key="method.code">
        <component
          :is="method.component"
          :braintree-client="braintreeClient"
          :transaction="transactionData"
          :is-selected="isPaymentMethodSelected(method.code)"
          @success="onPaymentSuccess"
        >
          <template #title>
            <SfRadio
              :selected="selectedPaymentMethod"
              :label="method.name"
              :value="method.code"
              @input="changePaymentMethod"
              class="form__radio"
            />
          </template>
        </component>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import braintree, { ApplePay } from 'braintree-web';
import Vue from 'vue'
import { currentStoreView } from '@vue-storefront/core/lib/multistore'

import { SfRadio } from '@storefront-ui/vue';

import TransactionData from '../types/transaction-data';

import CheckoutCard from './CheckoutCard.vue';
import CheckoutPayPal from './CheckoutPayPal.vue';
import CheckoutApplePay from './CheckoutApplePay.vue';
import { SN_BRAINTREE, SET_SELECTED_METHOD } from '../store/mutation-types';

export default Vue.extend({
  name: 'BraintreeClient',
  components: {
    CheckoutApplePay,
    CheckoutCard,
    CheckoutPayPal,
    SfRadio
  },
  data () {
    const storeView = currentStoreView();

    return {
      currency: storeView.i18n.currencyCode,
      showApplePayButton: false,
      applePayInstance: undefined as undefined | ApplePay,
      braintreeClient: undefined as undefined | braintree.Client
    }
  },
  async created () {
    const token = await this.$store.dispatch('braintree/generateToken');

    this.braintreeClient = await braintree.client.create({
      authorization: token
    });
  },
  computed: {
    braintreePaymentMethods () {
      return {
        card: {
          code: 'card',
          name: 'Card',
          component: CheckoutCard
        },
        applePay: {
          code: 'applePay',
          name: 'ApplePay',
          component: CheckoutApplePay
        },
        paypal: {
          code: 'paypal',
          name: 'Paypal',
          component: CheckoutPayPal
        }
      }
    },
    grandTotal () {
      let cartTotals = this.$store.getters['cart/getTotals']
      return cartTotals.find((seg) => seg.code === 'grand_total').value
    },
    selectedPaymentMethod () {
      const paymentDetails = this.$store.getters['checkout/getPaymentDetails'];
      if (paymentDetails.paymentMethod !== 'braintree') {
        return;
      }

      return this.$store.getters['braintree/selectedMethod'];
    },
    transactionData (): TransactionData {
      return { total: this.grandTotal, currency: this.currency };
    }
  },
  methods: {
    changePaymentMethod (code: string): void {
      this.$store.commit(`${SN_BRAINTREE}/${SET_SELECTED_METHOD}`, code);
      this.$emit('method-selected');
    },
    getPaymentMethodCode (payloadType: string): string | null {
      switch (payloadType) {
        case 'PayPalAccount':
          return 'gene_braintree_paypal';
        case 'CreditCard':
          return 'gene_braintree_creditcard';
        case 'ApplePayCard':
          return 'gene_braintree_applepay';
        default:
          return null;
      }
    },
    onPaymentSuccess (payload: any): void {
      this.$bus.$emit('checkout-do-placeOrder', {
        payment_method_nonce: payload.nonce,
        budsies_payment_method_code: this.getPaymentMethodCode(payload.type)
      })
    },
    isPaymentMethodSelected (code: string): boolean {
      return this.selectedPaymentMethod === code;
    }
  }
})
</script>
