import { currentStoreView } from '@vue-storefront/core/lib/multistore';
import PaymentDetails from '@vue-storefront/core/modules/checkout/types/PaymentDetails';
import Vue, { PropType, VueConstructor } from 'vue';

import { InjectType } from 'src/modules/shared';

interface InjectedServices {
  window: Window
}

export default (Vue as VueConstructor<Vue & InjectedServices>).extend({
  props: {
    braintreeClient: {
      type: Object as PropType<braintree.Client>,
      required: true
    }
  },
  inject: {
    window: { from: 'WindowObject' }
  } as unknown as InjectType<InjectedServices>,
  computed: {
    selectedBraintreeMethod (): string | undefined {
      if (this.paymentDetails.paymentMethod !== 'braintree') {
        return;
      }

      return this.$store.getters['braintree/selectedMethod'];
    },
    paymentDetails (): PaymentDetails {
      return this.$store.getters['checkout/getPaymentDetails'];
    },
    total (): number {
      let cartTotals = this.$store.getters['cart/getTotals']
      return cartTotals.find((seg) => seg.code === 'grand_total').value
    },
    currency (): string {
      return currentStoreView().i18n.currencyCode;
    }
  },
  methods: {
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
    }
  }
});
