import { Component } from 'vue';

import supportedMethodsCodes from '../types/SupportedMethodsCodes';

import PaymentApplePay from '../components/payment-apple-pay.vue';
import PaymentCard from '../components/payment-card.vue';
import PaymentGooglePay from '../components/payment-google-pay.vue';

export default function getComponentByMethodCode (methodCode: string): Component | undefined {
  switch (methodCode) {
    case supportedMethodsCodes.PAY_PAL:
    case supportedMethodsCodes.MAGENTO1_PAY_PAL:
    case supportedMethodsCodes.VENMO:
      return;
    case supportedMethodsCodes.CARD:
    case supportedMethodsCodes.MAGENTO1_CARD:
      return PaymentCard;
    case supportedMethodsCodes.APPLE_PAY:
    case supportedMethodsCodes.MAGENTO1_APPLE_PAY:
      return PaymentApplePay;
    case supportedMethodsCodes.GOOGLE_PAY:
      return PaymentGooglePay
  }
}
