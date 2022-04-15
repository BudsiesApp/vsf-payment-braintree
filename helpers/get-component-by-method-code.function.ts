import { Component } from 'vue';

import PaymentPayPal from '../components/payment-pay-pal.vue';
import PaymentCard from '../components/payment-card.vue';
import PaymentApplePay from '../components/payment-apple-pay.vue';
import supportedMethodsCodes from '../types/SupportedMethodsCodes';

export default function getComponentByMethodCode (methodCode: string): Component | undefined {
  switch (methodCode) {
    case supportedMethodsCodes.PAY_PAL:
      return PaymentPayPal;
    case supportedMethodsCodes.CARD:
      return PaymentCard;
    case supportedMethodsCodes.APPLE_PAY:
      return PaymentApplePay;
  }
}
