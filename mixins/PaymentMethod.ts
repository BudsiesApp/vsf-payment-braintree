import { Client } from 'braintree-web/dist/browser/client';
import { currentStoreView } from '@vue-storefront/core/lib/multistore';
import PaymentDetails from '@vue-storefront/core/modules/checkout/types/PaymentDetails';
import Vue, { PropType, VueConstructor } from 'vue';

import { InjectType } from 'src/modules/shared';

import { PaymentType } from '../types/payment-type';
import { ExpressCheckoutAuthorizedCallbackData, ExpressCheckoutUpdateData, ShippingDetailsChangedCallbackData } from '../types/express-checkout-data.interface';

interface InjectedServices {
  window: Window
}

export default (Vue as VueConstructor<Vue & InjectedServices>).extend({
  props: {
    braintreeClient: {
      type: Object as PropType<Client | undefined>,
      default: undefined
    },
    showContent: {
      type: Boolean,
      default: false
    },
    type: {
      type: String as PropType<PaymentType>,
      default: PaymentType.PAYMENT
    },
    onExpressCheckoutAuthorized: {
      type: Function as PropType<((data: ExpressCheckoutAuthorizedCallbackData) => Promise<void>) | undefined>,
      default: undefined
    },
    onShippingDetailsChanged: {
      type: Function as PropType<((data: ShippingDetailsChangedCallbackData) => Promise<ExpressCheckoutUpdateData>) | undefined>,
      default: undefined
    }
  },
  inject: {
    window: { from: 'WindowObject' }
  } as unknown as InjectType<InjectedServices>,
  computed: {
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
  }
});
