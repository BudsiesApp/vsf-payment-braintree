<template>
  <div class="express-checkout" v-if="braintreeClient">
    <div class="_buttons">
      <component
        v-for="btn in sorted"
        class="_button"
        :is="btn.is"
        :key="btn.key"
        :braintree-client="braintreeClient"
        :show-content="true"
        :on-express-checkout-authorized="onExpressCheckoutAuthorized"
        :on-shipping-details-changed="onShippingDetailsChanged"
        :type="PaymentType.EXPRESS_CHECKOUT"
        @success="onPaymentSuccess"
      />
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  inject,
  ref,
  onBeforeMount
} from '@vue/composition-api';

import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus';
import { registerModule } from '@vue-storefront/core/lib/modules';
import { OrderModule } from '@vue-storefront/core/modules/order';
import { CHECKOUT_UPDATE_SHIPPING_DETAILS_MUTATION, CHECKOUT_UPDATE_PAYMENT_DETAILS_MUTATION, useOrderCreation, CHECKOUT_SET_THANKYOU_MUTATION, CHECKOUT_UPDATE_EXPRESS_CHECKOUT_DATA_MUTATION } from '@vue-storefront/core/modules/checkout';
import PaymentApplePay from 'src/modules/payment-braintree/components/payment-apple-pay.vue';
import PaymentPayPal from 'src/modules/payment-braintree/components/payment-pay-pal.vue';
import PaymentGooglePay from 'src/modules/payment-braintree/components/payment-google-pay.vue';

import { PaymentType } from '../types/payment-type';
import { SN_BRAINTREE, SET_PAYMENT_METHOD_NONCE } from '../store/mutation-types';
import { ExpressCheckoutAuthorizedCallbackData, ExpressCheckoutUpdateData, ShippingDetailsChangedCallbackData } from '../types/express-checkout-data.interface';

type Platform = 'ios' | 'mac' | 'android' | 'windows' | 'other';

export default defineComponent({
  name: 'ExpressCheckoutButtons',
  components: {
    PaymentApplePay,
    PaymentPayPal,
    PaymentGooglePay
  },
  setup (props, context) {
    const root = context.root;
    const windowObj = inject<Window & typeof window | undefined>('WindowObject', undefined);
    const isPlacing = ref(false);

    const platform = computed<Platform>(() => {
      const ua = (windowObj && windowObj.navigator ? windowObj.navigator.userAgent : '').toLowerCase();
      if (/android/.test(ua)) return 'android';
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/macintosh|mac os x/.test(ua)) return 'mac';
      if (/windows/.test(ua)) return 'windows';
      return 'other';
    });

    const sorted = computed(() => {
      let order: ('apple' | 'paypal' | 'google')[] = [];

      if (['ios', 'mac'].includes(platform.value)) {
        order = ['apple', 'paypal', 'google'];
      } else if (platform.value === 'android') {
        order = ['google', 'paypal', 'apple'];
      } else {
        order = ['paypal', 'google', 'apple'];
      }

      const map = {
        apple: { is: 'PaymentApplePay', key: 'apple' },
        paypal: { is: 'PaymentPayPal', key: 'paypal' },
        google: { is: 'PaymentGooglePay', key: 'google' }
      };

      return order.map(k => map[k]);
    });

    const braintreeClient = ref(null);

    function onOrderAfterPlaced (payload: any) {
      root.$store.commit(CHECKOUT_UPDATE_EXPRESS_CHECKOUT_DATA_MUTATION, payload);
      root.$store.commit(CHECKOUT_SET_THANKYOU_MUTATION, true);
      root.$router.push({ name: 'checkout', params: { success: 'success' } });
    }

    onBeforeMount(async () => {
      braintreeClient.value = await root.$store.dispatch('braintree/createBraintreeClient');
      EventBus.$on('order-after-placed', onOrderAfterPlaced);
    });

    const totals = computed<number>(() => {
      const totals = root.$store.getters['cart/getTotals'];

      return totals.find((total: {code: string, value: number}) => total.code === 'grand_total').value;
    });

    const shippingMethods = computed<ExpressCheckoutUpdateData['availableShippingMethods']>(() => {
      return root.$store.getters['checkout/getShippingMethods'];
    });

    async function updateCustomerData (data: ExpressCheckoutAuthorizedCallbackData['customer']): Promise<void> {
      if (!data) {
        return;
      }

      await root.$store.dispatch('checkout/savePersonalDetails', data);

      if (data.firstName && data.lastName && data.emailAddress) {
        await root.$store.dispatch('budsies/updatePersonalDetails', data);
      }
    }

    async function onShippingDetailsChanged (data: ShippingDetailsChangedCallbackData): Promise<ExpressCheckoutUpdateData> {
      root.$store.commit(CHECKOUT_UPDATE_SHIPPING_DETAILS_MUTATION, data.shippingAddress);
      root.$store.commit(CHECKOUT_UPDATE_PAYMENT_DETAILS_MUTATION, data.paymentAddress);
      await root.$store.dispatch('cart/syncShippingMethods', { forceServerSync: true });

      let selectedShippingMethod = shippingMethods.value.find((method) => method.method_code === data.shippingMethod) || shippingMethods.value[0];

      if (!selectedShippingMethod) {
        return {
          total: {
            final: totals.value
          },
          availableShippingMethods: shippingMethods.value,
          selectedShippingMethod: ''
        }
      }

      root.$store.commit(
        CHECKOUT_UPDATE_SHIPPING_DETAILS_MUTATION,
        {
          shippingCarrier: selectedShippingMethod.carrier_code,
          shippingMethod: selectedShippingMethod.method_code
        }
      );

      await root.$store.dispatch('cart/fetchTotals');

      return {
        total: {
          final: totals.value
        },
        availableShippingMethods: shippingMethods.value,
        selectedShippingMethod: selectedShippingMethod.method_code || ''
      }
    }

    const { prepareOrderData } = useOrderCreation(context);

    const onExpressCheckoutAuthorized = async (data: ExpressCheckoutAuthorizedCallbackData): Promise<void> => {
      await updateCustomerData(data.customer);

      root.$store.commit(CHECKOUT_UPDATE_SHIPPING_DETAILS_MUTATION, data.shippingDetails);
      root.$store.commit(CHECKOUT_UPDATE_PAYMENT_DETAILS_MUTATION, data.paymentDetails);
      root.$store.commit(
        CHECKOUT_UPDATE_PAYMENT_DETAILS_MUTATION,
        { paymentMethod: data.paymentMethod }
      );
    };

    const onPaymentSuccess = async (): Promise<void> => {
      if (isPlacing.value) return;
      isPlacing.value = true;

      try {
        registerModule(OrderModule);

        const paymentMethodNonce = root.$store.getters['braintree/paymentMethodNonce'];
        root.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, undefined);
        await root.$store.dispatch(
          'checkout/placeOrder',
          { order: prepareOrderData({ payment_method_nonce: paymentMethodNonce }) }
        );
      } finally {
        isPlacing.value = false;
      }
    };

    return {
      braintreeClient,
      onShippingDetailsChanged,
      onExpressCheckoutAuthorized,
      onPaymentSuccess,
      platform,
      sorted,
      PaymentType
    };
  }
});
</script>

<style lang="scss" scoped>
.express-checkout {
  ._buttons {
    display: flex;
    flex-direction: column;
    row-gap: var(--spacer-sm);
  }
}
</style>
