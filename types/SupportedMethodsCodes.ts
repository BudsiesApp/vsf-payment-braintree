enum supportedMethodsCodes {
  MAGENTO1_PAY_PAL = 'gene_braintree_paypal',
  PAY_PAL = 'braintree_paypal',
  // Virtual method, mapped to the PAY_PAL before placing the order
  PAY_PAL_PAY_LATER = 'braintree_paypal_pay_later',
  MAGENTO1_APPLE_PAY = 'gene_braintree_applepay',
  APPLE_PAY = 'braintree_applepay',
  MAGENTO1_CARD = 'gene_braintree_creditcard',
  CARD = 'braintree',
  GOOGLE_PAY = 'braintree_googlepay'
}

export default supportedMethodsCodes;
