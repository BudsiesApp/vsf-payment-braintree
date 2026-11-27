import PayPal from '../../components/payment-pay-pal.vue';
import ApplePay from '../../components/payment-apple-pay.vue';
import GooglePay from '../../components/payment-google-pay.vue';
import PaymentMethod from '../../mixins/PaymentMethod';
import Vue from 'vue';
import Vuex from 'vuex';
import cartGetters from '@vue-storefront/core/modules/cart/store/getters';

jest.mock('config', () => ({ braintree: { applePay: { label: 'Store' } } }));
jest.mock('src/modules/shared', () => ({ PaymentType: { EXPRESS_CHECKOUT: 'express' }, DEFAULT_CURRENCY_CODE: 'USD' }));
jest.mock('@vue-storefront/core/lib/multistore', () => ({ currentStoreView: () => ({ i18n: { currencyCode: 'USD' } }) }));
jest.mock('@vue-storefront/core/helpers', () => ({}));
jest.mock('@vue-storefront/core/modules/cart/helpers', () => ({}));
jest.mock('@vue-storefront/core/modules/cart/helpers/get-cart-item-key.function', () => ({ __esModule: true, default: () => '' }));
jest.mock('@vue-storefront/core/lib/logger', () => ({ Logger: { error: () => () => {} } }));
jest.mock('@vue-storefront/core/compatibility/plugins/event-bus', () => ({ __esModule: true, default: { $emit: jest.fn() } }));

describe('express wallet initiation', () => {
  it('requires live readiness only for express payment', () => {
    const computed = (PaymentMethod as any).options.computed.canInitiatePayment;
    const vm = { isExpressCheckout: false, $store: { getters: { 'cart/canStartExpressCheckout': false } } };
    expect(computed.call(vm)).toBe(true);
    vm.isExpressCheckout = true;
    expect(computed.call(vm)).toBe(false);
    vm.$store.getters['cart/canStartExpressCheckout'] = true;
    expect(computed.call(vm)).toBe(true);
  });
  it('checks both PayPal funding sources at their SDK click boundary', async () => {
    const configs: any[] = [];
    const button = { isEligible: () => true, render: jest.fn() };
    const vm: any = {
      window: { paypal: { FUNDING: { PAYPAL: 'paypal', PAYLATER: 'paylater' }, Buttons: config => { configs.push(config); return button; } } },
      renderedButtonByFundingSource: {}, isExpressCheckout: true, canInitiatePayment: false,
      paypalCheckoutInstance: { createPayment: jest.fn() }, $emit: jest.fn(), currency: 'USD', total: 10
    };
    vm.onPayPalCreateOrder = (PayPal as any).options.methods.onPayPalCreateOrder.bind(vm);
    await (PayPal as any).options.methods.onPayPalSdkLoaded.call(vm);
    const actions = { resolve: jest.fn(), reject: jest.fn() };
    configs.forEach(config => config.onClick({}, actions));
    expect(actions.reject).toHaveBeenCalledTimes(2);
    expect(vm.paypalCheckoutInstance.createPayment).not.toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
    vm.canInitiatePayment = true;
    vm.total = 20;
    configs.forEach(config => config.onClick({}, actions));
    expect(actions.resolve).toHaveBeenCalledTimes(2);
    configs.forEach(config => config.createOrder());
    expect(vm.paypalCheckoutInstance.createPayment).toHaveBeenCalledTimes(2);
    expect(vm.paypalCheckoutInstance.createPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 20 }));
  });

  it('does not create an Apple Pay request while blocked', () => {
    const createPaymentRequest = jest.fn();
    const begin = jest.fn();
    const session = jest.fn().mockImplementation(() => ({ begin }));
    (session as any).canMakePayments = () => true;
    const vm: any = { window: { ApplePaySession: session }, canInitiatePayment: false, applePayCheckoutInstance: { createPaymentRequest }, $emit: jest.fn(), total: 20, isExpressCheckout: true };
    (ApplePay as any).options.methods.isApplePayAvailable.call(vm);
    (ApplePay as any).options.methods.doPayment.call(vm);
    expect(createPaymentRequest).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
    vm.canInitiatePayment = true;
    createPaymentRequest.mockReturnValue({});
    (ApplePay as any).options.methods.doPayment.call(vm);
    expect(createPaymentRequest).toHaveBeenCalledWith({ total: { label: 'Store', amount: '20' } });
    expect(begin).toHaveBeenCalledTimes(1);
    expect(vm.$emit).toHaveBeenCalledWith('payment-started');
  });

  it('requires a new Google Pay click and uses its current amount', async () => {
    const request = jest.fn(data => data);
    const load = jest.fn().mockRejectedValue({ name: 'AbortError' });
    const vm: any = {
      canInitiatePayment: false, googlePayCheckoutInstance: { createPaymentDataRequest: request },
      googlePayClient: { loadPaymentData: load }, $emit: jest.fn(), total: 10,
      isExpressCheckout: true, expressCheckoutPaymentRequestData: {}
    };
    await (GooglePay as any).options.methods.doPayment.call(vm);
    expect(request).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
    vm.canInitiatePayment = true;
    vm.total = 20;
    expect(load).not.toHaveBeenCalled();
    await (GooglePay as any).options.methods.doPayment.call(vm);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ transactionInfo: expect.objectContaining({ totalPrice: '20' }) }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('rejects PayPal and Pay Later clicks while a quantity edit is pending and accepts a fresh click after matching totals', async () => {
    Vue.use(Vuex);
    const totals = { base_grand_total: 10, base_tax_amount: 0, base_shipping_amount: 0, base_subtotal: 10, base_discount_amount: 0, quote_currency_code: 'USD' };
    const store = new Vuex.Store({ modules: { cart: {
      namespaced: true,
      state: {
        cartServerToken: 'quote', cartServerLastTotalsSyncDate: 1, platformTotals: totals, hasTotalsRefreshFailed: false,
        cartItems: [{ server_item_id: 7, qty: 1 }], itemsAfterPlatformTotals: { 7: { item_id: 7, qty: 1 } }
      },
      getters: {
        ...cartGetters, getIsAdding: () => false, IS_CART_SYNCING: () => false, isTotalsSettling: () => false, IS_COUPON_PROCESSING: () => false
      },
      mutations: { setQuantity: (state, qty) => { state.cartItems[0].qty = qty; }, applyTotals: (state, qty) => { state.itemsAfterPlatformTotals = { 7: { item_id: 7, qty } }; } }
    } } });
    const configs: any[] = [];
    const button = { isEligible: () => true, render: jest.fn() };
    const vm: any = {
      window: { paypal: { FUNDING: { PAYPAL: 'paypal', PAYLATER: 'paylater' }, Buttons: config => { configs.push(config); return button; } } },
      renderedButtonByFundingSource: {}, isExpressCheckout: true, $store: store
    };
    Object.defineProperty(vm, 'canInitiatePayment', { get: () => (PaymentMethod as any).options.computed.canInitiatePayment.call(vm) });
    await (PayPal as any).options.methods.onPayPalSdkLoaded.call(vm);
    const actions = { resolve: jest.fn(), reject: jest.fn() };
    store.commit('cart/setQuantity', 2);
    configs.forEach(config => config.onClick({}, actions));
    expect(actions.reject).toHaveBeenCalledTimes(2);
    expect(actions.resolve).not.toHaveBeenCalled();
    store.commit('cart/applyTotals', 2);
    configs.forEach(config => config.onClick({}, actions));
    expect(actions.resolve).toHaveBeenCalledTimes(2);
  });
});
