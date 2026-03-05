<template>
  <div
    class="pay-pal-pay-later-messaging"
    data-pp-message
    :data-pp-placement="placement"
    :data-pp-amount="amount"
    :data-pp-style-text-align="alignment"
  />
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';

import { isServer } from '@vue-storefront/core/helpers';
import { Logger } from '@vue-storefront/core/lib/logger';

type PayPalMessagePlacement = 'product' | 'cart' | 'checkout' | 'home' | 'category';
type Alignment = 'left' | 'center' | 'right';

export default Vue.extend({
  name: 'PayPalPayLaterMessaging',
  props: {
    amount: {
      type: Number,
      required: true
    },
    placement: {
      type: String as PropType<PayPalMessagePlacement>,
      required: true
    },
    alignment: {
      type: String as PropType<Alignment>,
      default: 'left'
    }
  },
  mounted (): void {
    if (isServer) {
      return;
    }

    this.loadSdk();
  },
  methods: {
    async loadSdk (): Promise<void> {
      try {
        await this.$store.dispatch('braintree/ensurePayPalSdkLoaded');
      } catch (error) {
        Logger.error('PayPalPayLaterMessaging: SDK load error: ' + error, 'pay-pal-pay-later-messaging')();
      }
    }
  }
});
</script>
