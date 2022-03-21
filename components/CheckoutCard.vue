<template>
  <div class="checkout-card">
    <slot name="title" v-bind="{isSelected}" />

    <div class="_content" v-show="isSelected">
      <div class="_row">
        <div class="_field">
          <label for="card-number" class="_label">Card Number</label>
          <div id="card-number" class="_input" />
        </div>
      </div>

      <div class="_row">
        <div class="_field">
          <label for="cvv" class="_label">CVV</label>
          <div id="cvv" class="_input" />
        </div>

        <div class="_field">
          <label for="expiration-date" class="_label">Expiration Date</label>
          <div id="expiration-date" class="_input" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import braintree, { HostedFields } from 'braintree-web';
import Vue, { PropType, VueConstructor } from 'vue'
import { InjectType } from 'src/modules/shared';

import TransactionData from '../types/transaction-data';

interface InjectedServices {
  window: Window
}

export default (Vue as VueConstructor<Vue & InjectedServices>).extend({
  name: 'CheckoutCard',
  inject: {
    window: { from: 'WindowObject' }
  } as unknown as InjectType<InjectedServices>,
  props: {
    braintreeClient: {
      type: Object as PropType<braintree.Client>,
      required: true
    },
    transaction: {
      type: Object as PropType<TransactionData>,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      hostedFieldsInstance: undefined as undefined | HostedFields,
      fSubmitHandler: undefined as undefined | ((event: MouseEvent) => Promise<void>)
    }
  },
  async created (): Promise<void> {
    try {
      this.hostedFieldsInstance = await braintree.hostedFields.create({
        client: this.braintreeClient,
        styles: {
          'input': {
            'font-size': '16px',
            'color': '#535353'
          },

          '.number': {
            'font-family': 'monospace'
          },

          '.valid': {
            'color': 'green'
          }
        },
        fields: {
          number: {
            selector: '#card-number'
          },
          cvv: {
            selector: '#cvv'
          },
          expirationDate: {
            selector: '#expiration-date'
          }
        }
      });

      this.hostedFieldsCreated();
    } catch (error) {
      this.$emit('error', error);
    }
  },
  beforeDestroy (): void {
    const placeOrderButton = this.getPlaceOrderButton();

    if (!placeOrderButton || !this.fSubmitHandler) {
      return;
    }

    placeOrderButton.removeEventListener('click', this.fSubmitHandler);
  },
  methods: {
    getPlaceOrderButton (): HTMLElement | null {
      return document.querySelector('.place-order-btn');
    },
    hostedFieldsCreated (): void {
      const submitButton = this.getPlaceOrderButton();
      if (!submitButton) {
        return;
      }

      this.fSubmitHandler = this.submitHandler.bind(this);

      submitButton.addEventListener('click', this.fSubmitHandler);
    },
    async submitHandler (event: MouseEvent): Promise<void> {
      event.preventDefault();

      if (!this.hostedFieldsInstance || !this.isSelected) {
        return;
      }

      const payload = await this.hostedFieldsInstance.tokenize();
      this.$emit('success', payload);
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@storefront-ui/shared/styles/helpers/typography";

.checkout-card {
  ._content {
    margin-top: var(--spacer-sm);
  }

  ._row {
    display: flex;
  }

  ._field {
    flex: 1;
    margin-right: var(--spacer-lg);

    &:last-child {
      margin-right: 0;
    }
  }

  ._input {
    height: 32px;
    margin-bottom: 1em;
    display: block;
    background-color: transparent;
    color: rgba(0, 0, 0, .87);
    border: none;
    border-bottom: 1px solid rgba(0, 0, 0, .26);
    outline: 0;
    width: 100%;
    font-size: 16px;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    position: relative;
  }

  ::v-deep {
    .braintree-hosted-fields-focused {
      border-bottom: 1px solid var(--c-light);
      transition: all 200ms ease;
    }

    .braintree-hosted-fields-invalid {
      border-bottom: 1px solid var(--c-danger);
      transition: all 200ms ease;
    }
  }
}
</style>
