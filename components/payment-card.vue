<template>
  <div class="checkout-card">
    <slot />

    <div class="_content" v-show="showContent">
      <div class="_row">
        <div
          class="_field"
          :class="{ '-error': showNumberError, '-filled': isNumberFieldFilled }"
        >
          <div id="card-number" class="_input" />

          <label for="card-number" class="_label">
            {{ $t('Card number') }}
          </label>
        </div>
      </div>

      <div class="_row">
        <div
          class="_field"
          :class="{ '-error': showCvvError, '-filled': isCvvFieldFilled }"
        >
          <div id="cvv" class="_input" />

          <label for="cvv" class="_label">
            {{ $t('CVV') }}
          </label>
        </div>

        <div
          class="_field"
          :class="{ '-error': showExpirationDateError, '-filled': isExpirationDateFieldFilled }"
        >
          <div id="expiration-date" class="_input" />

          <label for="expiration-date" class="_label">
            {{ $t('Expiration date') }}
          </label>
        </div>
      </div>

      <div class="_error-message">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import hostedFields, { BraintreeError, HostedFields, HostedFieldsEvent } from 'braintree-web/dist/browser/hosted-fields';
import { TranslateResult } from 'vue-i18n';

import { Dictionary } from 'src/modules/budsies';
import PaymentMethod from 'src/modules/payment-braintree/mixins/PaymentMethod';
import { SET_PAYMENT_METHOD_NONCE, SN_BRAINTREE } from 'src/modules/payment-braintree/store/mutation-types';

const enum Fields {
  NUMBER = 'number',
  EXPIRATION_DATE = 'expirationDate',
  CVV = 'cvv'
}

export default PaymentMethod.extend({
  name: 'PaymentCard',
  data () {
    const fieldsValidationState: Dictionary<{isValid: boolean, isEmpty: boolean}> = {
      [Fields.NUMBER]: {
        isValid: true,
        isEmpty: true
      },
      [Fields.CVV]: {
        isValid: true,
        isEmpty: true
      },
      [Fields.EXPIRATION_DATE]: {
        isValid: true,
        isEmpty: true
      }
    };

    return {
      hostedFieldsInstance: undefined as undefined | HostedFields,
      fieldsValidationState,
      errorMessage: '' as TranslateResult,
      fOnHostedFieldsBlur: undefined as ((event: HostedFieldsEvent) => void) | undefined,
      fOnHostedFieldsFocus: undefined as ((event: HostedFieldsEvent) => void) | undefined
    }
  },
  computed: {
    isCvvFieldFilled (): boolean {
      return !this.fieldsValidationState[Fields.CVV].isEmpty;
    },
    isExpirationDateFieldFilled (): boolean {
      return !this.fieldsValidationState[Fields.EXPIRATION_DATE].isEmpty;
    },
    isNumberFieldFilled (): boolean {
      return !this.fieldsValidationState[Fields.NUMBER].isEmpty;
    },
    showCvvError (): boolean {
      return !this.fieldsValidationState[Fields.CVV].isValid;
    },
    showExpirationDateError (): boolean {
      return !this.fieldsValidationState[Fields.EXPIRATION_DATE].isValid;
    },
    showNumberError (): boolean {
      return !this.fieldsValidationState[Fields.NUMBER].isValid;
    }
  },
  async created (): Promise<void> {
    if (!this.braintreeClient) {
      return;
    }

    this.createHostedFieldsInstance(this.braintreeClient);
  },
  beforeDestroy (): void {
    this.removeHostedFieldsEventListeners();
  },
  methods: {
    addHostedFieldsEventListeners (): void {
      if (!this.hostedFieldsInstance) {
        throw new Error('Hosted fields instance is undefined');
      }

      this.fOnHostedFieldsBlur = this.onHostedFieldsBlur.bind(this);
      this.hostedFieldsInstance.on('blur', this.fOnHostedFieldsBlur);

      this.fOnHostedFieldsFocus = (event) => {
        this.fieldsValidationState[event.emittedBy].isValid = true;
      };
      this.hostedFieldsInstance.on('focus', this.fOnHostedFieldsFocus);
    },
    async createHostedFieldsInstance (braintreeClient: braintree.Client): Promise<void> {
      if (this.hostedFieldsInstance) {
        return;
      }

      try {
        this.hostedFieldsInstance = await hostedFields.create({
          client: braintreeClient,
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

        this.addHostedFieldsEventListeners();
      } catch (error) {
        this.$emit('error', error);
      }
    },
    removeHostedFieldsEventListeners (): void {
      if (!this.hostedFieldsInstance) {
        return;
      }

      if (this.fOnHostedFieldsFocus) {
        this.hostedFieldsInstance.off('focus', this.fOnHostedFieldsFocus);
      }

      if (this.fOnHostedFieldsBlur) {
        this.hostedFieldsInstance.off('blur', this.fOnHostedFieldsBlur);
      }
    },
    onHostedFieldsBlur (event: HostedFieldsEvent): void {
      const fieldState = event.fields[event.emittedBy];
      this.fieldsValidationState[event.emittedBy].isEmpty = fieldState.isEmpty;

      if ((!fieldState.isValid && !fieldState.isEmpty) || fieldState.isEmpty) {
        this.fieldsValidationState[event.emittedBy].isValid = false;
      }

      if (!this.showCvvError && !this.showExpirationDateError && !this.showNumberError) {
        this.errorMessage = '';
      }
    },
    async doPayment (): Promise<void> {
      this.errorMessage = '';

      if (!this.hostedFieldsInstance) {
        throw new Error('Hosted fields instance is undefined');
      }

      try {
        const payload = await this.hostedFieldsInstance.tokenize();

        this.$store.commit(`${SN_BRAINTREE}/${SET_PAYMENT_METHOD_NONCE}`, payload.nonce);

        this.$emit('success');
      } catch (error) {
        const braintreeError = error as BraintreeError;

        if (braintreeError.details && braintreeError.details.invalidFieldKeys) {
          braintreeError.details.invalidFieldKeys.forEach((key: string) => {
            this.fieldsValidationState[key].isValid = false;
          })
        }

        switch (braintreeError.code) {
          case 'HOSTED_FIELDS_FIELDS_EMPTY':
            [Fields.EXPIRATION_DATE, Fields.NUMBER, Fields.CVV].forEach((key) => {
              this.fieldsValidationState[key].isValid = false;
            })
            this.errorMessage = this.$t('Please, fill required fields');
            break;
          case 'HOSTED_FIELDS_FIELDS_INVALID':
            this.errorMessage = this.$t('Some fields are invalid');
            break;
          case 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE':
            // https://developer.paypal.com/braintree/docs/reference/request/client-token/generate#options.fail_on_duplicate_payment_method
            this.errorMessage = this.$t('This payment method already exists in Your vault.');
            break;
          case 'HOSTED_FIELDS_TOKENIZATION_CVV_VERIFICATION_FAILED':
            this.errorMessage = this.$t('CVV did not pass verification');
            this.fieldsValidationState[Fields.CVV].isValid = false;
            break;
          case 'HOSTED_FIELDS_FAILED_TOKENIZATION':
            this.errorMessage = this.$t('Please, check credentials');
            break;
          case 'HOSTED_FIELDS_TOKENIZATION_NETWORK_ERROR':
            this.errorMessage = this.$t('Network error. Please try again later');
            break;
          default:
            this.errorMessage = this.$t('Something went wrong');
        }
      }
    }
  },
  watch: {
    braintreeClient: {
      handler (val) {
        if (!val) {
          return;
        }

        this.createHostedFieldsInstance(val);
      }
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@storefront-ui/shared/styles/helpers/breakpoints";

.checkout-card {
  --input-label-font-size: var(--font-size-base);

  ._content {
    background-color: var(--c-white-darken);
    margin-top: var(--spacer-sm);
    padding: var(--spacer-sm);
  }

  ._row {
    display: flex;

    &:first-child {
      margin-bottom: var(--spacer-base);
    }
  }

  ._input {
    height: 32px;
    display: block;
    border-bottom: 1px solid var(--c-light);
    width: 100%;
    position: relative;
    padding: var(--spacer-sm) 0 var(--spacer-xs) 0;
  }

  ._label {
    position: absolute;
    top: var(--label-top, 50%);
    color: var(--label-color, inherit);
    font-weight: var(--font-normal);
    font-family: var(--font-family-secondary);
    line-height: 1;
    font-size: var(--input-label-font-size, var(--font-lg));
    transform: translate3d(0, calc(var(--input-label-top, 50%) * -1), 0);
    transition: top 150ms linear, font-size 150ms linear;

    &::after {
      color: var(--c-primary);
      content: '*'
    }
  }

  ._field {
    flex: 1;
    margin-right: var(--spacer-lg);
    position: relative;

    &:last-child {
      margin-right: 0;
    }

    &.-filled {
      ._label {
        --label-top: 0;
        --input-label-font-size: var(--font-2xs);
      }
    }

    &.-error {
      .braintree-hosted-fields-focused {
        border-bottom: 1px solid var(--c-primary);

        ~ ._label {
          color: var(--c-danger-variant);

          &::after {
            color: var(--c-danger-variant);
          }
        }
      }

      ._input {
        border-bottom-color: var(--c-danger);
      }
    }
  }

  ._error-message {
    font-size: 0.8em;
    margin-top: 0.5em;
    color: var(--c-danger-variant);
  }

  .braintree-hosted-fields-focused {
    border-bottom: 1px solid var(--c-primary);

    ~ ._label {
      --label-top: 0;
      --label-color: var(--c-primary);
      --input-label-font-size: var(--font-2xs);
    }
  }

  @include for-desktop {
    ._content {
      margin-left: var(--spacer-xl);
    }
  }
}
</style>
