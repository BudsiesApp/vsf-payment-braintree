<template>
  <div class="braintree-dropin">
    <template v-if="!isBraintreeUnavailable">
      <div class="_loader-container" v-if="!isDropinInitialized">
        <div class="loader" />
      </div>

      <div class="_list" v-show="isDropinInitialized">
        <div v-for="method in activeBraintreePaymentMethods" :key="method.code">
          <SfRadio
            :selected="selectedPaymentMethod"
            :label="method.name"
            :value="method.code"
            name="payment-method"
            class="form__radio payment-method"
            @input="changePaymentMethod"
          />
          <div class="braintree" :id="method.containerId" :ref="method.containerId" v-show="isMethodSelected(method.code)" />
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { currentStoreView } from '@vue-storefront/core/lib/multistore'
import config from 'config'

import { SET_SELECTED_METHOD, SN_BRAINTREE } from '../store/mutation-types';

import { SfRadio } from '@storefront-ui/vue';

export default {
  name: 'BraintreeDropin',
  components: {
    SfRadio
  },
  data () {
    const storeView = currentStoreView()
    return {
      loader: false,
      commit: true,
      nonce: '',
      currency: storeView.i18n.currencyCode,
      locale: storeView.i18n.defaultLocale.replace('-', '_'), // Convert to PayPal format of locale
      isDropinInitialized: false,
      availableMethods: [],
      buttonClickHandlers: [],
      isBraintreeUnavailable: false
    }
  },
  mounted () {
    this.configureBraintree();
  },
  beforeDestroy () {
    const button = this.getPlaceOrderButton();

    this.buttonClickHandlers.forEach((handler) => {
      button.removeEventListener('click', handler);
    });
  },
  computed: {
    selectedPaymentMethod () {
      const paymentDetails = this.$store.getters['checkout/getPaymentDetails'];
      if (paymentDetails.paymentMethod !== 'braintree') {
        return;
      }

      return this.$store.getters['braintree/selectedMethod'];
    },
    activeBraintreePaymentMethods () {
      return this.isDropinInitialized ? this.availableMethods : this.allBraintreePaymentMethods;
    },
    grandTotal () {
      let cartTotals = this.$store.getters['cart/getTotals']
      return cartTotals.find(seg => seg.code === 'grand_total').value
    },
    allBraintreePaymentMethods () {
      return {
        card: {
          code: 'card',
          name: 'Card',
          containerId: 'braintree-card'
        },
        applePay: {
          code: 'applePay',
          name: 'ApplePay',
          containerId: 'braintree-applePay',
          dropinOptions: {
            displayName: config.braintree.applePay.displayName,
            paymentRequest: {
              total: {
                label: config.braintree.applePay.label,
                amount: this.getTransactions().amount.total
              },
              requiredBillingContactFields: ['postalAddress']
            }
          }
        },
        paypal: {
          dropinOptions: {
            flow: 'checkout',
            amount: this.getTransactions().amount.total,
            currency: this.getTransactions().amount.currency
          },
          containerId: 'braintree-paypal',
          code: 'paypal',
          name: 'Paypal'
        }
      }
    }
  },
  methods: {
    changePaymentMethod (code) {
      this.$store.commit(`${SN_BRAINTREE}/${SET_SELECTED_METHOD}`, code);
      this.$emit('method-selected');
    },
    async configureBraintree () {
      const token = await this.$store.dispatch('braintree/generateToken');
      console.debug('Code for braintree:' + token);

      if (!token) {
        this.isBraintreeUnavailable = true;
        return;
      }

      try {
        // Need to initialize applePay instance first to avoid incorrect dropin behavior if ApplePay doesn't exist.
        const applePayInstance = await this.configureApplePay(token);

        const dropinInstances = await Promise.all([
          this.configurePayPal(token),
          this.configureCard(token)
        ]);

        if (applePayInstance) {
          dropinInstances.push(applePayInstance);
        }

        dropinInstances.forEach((instance) => {
          this.onDropinInstanceCreated(instance);
        });

        this.isDropinInitialized = true;
      } catch (error) {
        this.isBraintreeUnavailable = true;
      }
    },
    async configureCard (token) {
      var dropin = require('braintree-web-drop-in')
      try {
        const dropinInstance = await dropin.create({
          authorization: token,
          container: `#${this.allBraintreePaymentMethods.card.containerId}`
        });

        this.availableMethods.push(this.allBraintreePaymentMethods.card);
        return dropinInstance;
      } catch (error) {
        console.log(error);
      }
    },
    async configurePayPal (token) {
      var dropin = require('braintree-web-drop-in')

      try {
        const dropinInstance = await dropin.create({
          authorization: token,
          container: `#${this.allBraintreePaymentMethods.paypal.containerId}`,
          paypal: this.allBraintreePaymentMethods.paypal.dropinOptions,
          card: false
        });

        this.availableMethods.push(this.allBraintreePaymentMethods.paypal);
        return dropinInstance;
      } catch (error) {
        console.log(error);
      }
    },
    async configureApplePay (token) {
      var dropin = require('braintree-web-drop-in')
      try {
        const dropinInstance = await dropin.create({
          authorization: token,
          container: `#${this.allBraintreePaymentMethods.applePay.containerId}`,
          applePay: this.allBraintreePaymentMethods.applePay.dropinOptions,
          card: false
        });

        this.availableMethods.push(this.allBraintreePaymentMethods.applePay);
        return dropinInstance;
      } catch (error) {
        console.log(error);
      }
    },
    onDropinInstanceCreated (dropinInstance) {
      const handler = () => {
        if (dropinInstance.isPaymentMethodRequestable()) {
          setTimeout(() => {
            dropinInstance.requestPaymentMethod((err, payload) => {
              if (err) {
                console.error(err)
                return
              }

              this.nonce = payload.nonce

              this.$bus.$emit('checkout-do-placeOrder', {
                payment_method_nonce: this.nonce,
                budsies_payment_method_code: this.getPaymentMethodCode(payload.type)
              })
            })
          }, 400)
        }
      };

      this.buttonClickHandlers.push(handler);
      this.getPlaceOrderButton().addEventListener('click', handler)
    },
    isMethodSelected (methodCode) {
      return this.selectedPaymentMethod === methodCode;
    },
    getTransactions () {
      return { amount: { total: this.grandTotal, currency: this.currency } }
    },
    getNonce () {
      return { nonce: this.nonce, total: this.grandTotal, currency: this.currency }
    },
    getPaymentMethodCode (payloadType) {
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
    getPlaceOrderButton () {
      return document.querySelector('.place-order-btn');
    },
    doPayment (data, actions) {
      return this.$store.dispatch(`${SN_BRAINTREE}/doPayment`, this.getNonce())
    },
    onAuthorize (data, actions) {
      return true
    },
    onCancel (data) {
      this.$emit('payment-braintree-cancelled', data)
    }
  }
}
</script>

<style lang="scss" scoped>
$loader-size: 2em;

.braintree-dropin {
  ._loader-container {
  position: relative;
  width: 100%;
  height: $loader-size;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding-left: 0.74rem;

    .loader {
      position: absolute;
      width: $loader-size;
      height: $loader-size;
      border-radius: 100%;
      border: 2px solid var(--c-secondary);
      border-bottom-color: var(--c-primary);
      animation: rotate 1s linear infinite;
    }
  }

  ::v-deep {
    .braintree-heading {
      display: none;
    }
  }
}
</style>
