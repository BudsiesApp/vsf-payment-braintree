<template>
  <div class="braintree" id="braintree" />
</template>

<script>
import { currentStoreView } from '@vue-storefront/core/lib/multistore'
import config from 'config'

export default {
  name: 'BraintreeDropin',
  data () {
    const storeView = currentStoreView()
    return {
      loader: false,
      commit: true,
      nonce: '',
      currency: storeView.i18n.currencyCode,
      locale: storeView.i18n.defaultLocale.replace('-', '_') // Convert to PayPal format of locale
    }
  },
  mounted () {
    this.configureBraintree()
  },
  computed: {
    grandTotal () {
      let cartTotals = this.$store.getters['cart/getTotals']
      return cartTotals.find(seg => seg.code === 'grand_total').value
    }
  },
  methods: {
    configureBraintree () {
      var self = this
      this.$store.dispatch('braintree/generateToken').then((resp) => {
        var dropin = require('braintree-web-drop-in')
        console.debug('Code for braintree:' + resp)
        var button = document.querySelector('.place-order-btn')
        dropin.create({
          authorization: resp,
          container: '#braintree',
          paypal: {
            flow: 'checkout',
            amount: this.getTransactions().amount.total,
            currency: this.getTransactions().amount.currency
          },
          applePay: {
            displayName: config.braintree.applePay.displayName,
            paymentRequest: {
              total: {
                label: config.braintree.applePay.label,
                amount: this.getTransactions().amount.total
              },
              requiredBillingContactFields: ['postalAddress']
            }
          }
        }).then((dropinInstance) => {
          button.addEventListener('click', () => {
            if (dropinInstance.isPaymentMethodRequestable()) {
              setTimeout(() => {
                dropinInstance.requestPaymentMethod((err, payload) => {
                  if (err) {
                    console.error(err)
                    return
                  }

                  // Submit payload.nonce to your server
                  self.nonce = payload.nonce

                  self.$bus.$emit('checkout-do-placeOrder', {
                    payment_method_nonce: self.nonce,
                    budsies_payment_method_code: this.getPaymentMethodCode(payload.type)
                  })
                })
              }, 400)
            }
          })
        }).catch((error) => {
          console.error(error)
        })
      }).catch((error) => {
        console.error(error)
      })
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
    doPayment (data, actions) {
      return this.$store.dispatch('braintree/doPayment', this.getNonce())
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
