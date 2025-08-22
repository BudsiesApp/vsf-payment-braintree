import ShippingMethod from '@vue-storefront/core/modules/cart/types/ShippingMethod';
import supportedMethodsCodes from './SupportedMethodsCodes';

export interface MainAddressData {
  country: string,
  city: string,
  state: string,
  region_id: number | null,
  zipCode: string
}

export interface AdditionalAddressData {
  firstName: string,
  lastName: string,
  streetAddress: string,
  phoneNumber?: string
}

export interface ShippingDetailsChangedCallbackData {
  shippingAddress: MainAddressData,
  paymentAddress: MainAddressData,
  shippingMethod: string
}

export interface ExpressCheckoutAuthorizedCallbackData {
  paymentMethod: supportedMethodsCodes,
  customer: {
    firstName: string,
    lastName: string,
    emailAddress: string
  },
  shippingDetails: AdditionalAddressData,
  paymentDetails: AdditionalAddressData
}

export interface ExpressCheckoutUpdateData {
  total: {
    final: number
  },
  availableShippingMethods: ShippingMethod[],
  selectedShippingMethod: string
}

export interface ExpressCheckoutAuthorizedCallbackResult {
  success: boolean,
  requiredFieldsMissing: string[]
}
