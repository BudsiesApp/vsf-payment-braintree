import { ActionTree } from 'vuex';
import client, { Client } from 'braintree-web/dist/browser/client';
import paypalCheckout from 'braintree-web/dist/browser/paypal-checkout';
import config from 'config'
import { isServer } from '@vue-storefront/core/helpers';
import { adjustMultistoreApiUrl } from '@vue-storefront/core/lib/multistore'
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'

import { BraintreeState } from '../types/BraintreeState'
import { BEFORE_STORE_BACKEND_API_REQUEST } from 'src/modules/shared';
import {
  SET_BRAINTREE_CLIENT,
  SET_BRAINTREE_CLIENT_CREATION_PROMISE,
  SET_BRAINTREE_CLIENT_EXPIRATION_DATE,
  SET_PAYPAL_CHECKOUT_INSTANCE,
  SET_PAYPAL_SDK_LOAD_PROMISE,
  SET_IS_PAYPAL_SDK_LOADED
} from './mutation-types';
import { BRAINTREE_CLIENT_EXPIRATION_TIMEOUT } from '../types/braintree-client-expiration-timeout';

// it's a good practice for all actions to return Promises with effect of their execution
export const actions: ActionTree<BraintreeState, any> = {
  generateToken () {
    let url = config.braintree.endpoint + '/get-token'

    const mode: RequestMode = 'cors';
    const payload = {
      method: 'GET',
      mode,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      }
    };

    const eventPayload = {
      url
    };

    EventBus.$emit(BEFORE_STORE_BACKEND_API_REQUEST, eventPayload);

    return fetch(url, payload).then(resp => { return resp.json() })
      .then((resp) => {
        console.debug(resp.result.token)
        return resp.result.token
      })
  },
  doPayment (params) {
    let url = config.braintree.endpoint + '/do-payment';
    const mode: RequestMode = 'cors';
    const payload = {
      method: 'POST',
      mode,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    };

    const eventPayload = {
      url
    };

    EventBus.$emit(BEFORE_STORE_BACKEND_API_REQUEST, eventPayload);

    return fetch(url, payload).then(resp => { return resp.json() })
      .then((resp) => {
        console.debug(resp)
        return resp
      })
  },
  // if you are using cache in your module it's a good practice to allow developers to choose either to use it or not
  execute (params) {
    let url = config.paypal.endpoint.execute
    url = config.storeViews.multistore ? adjustMultistoreApiUrl(url) : url
    const mode: RequestMode = 'cors';
    const payload = {
      method: 'POST',
      mode,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    };

    const eventPayload = {
      url
    };

    EventBus.$emit(BEFORE_STORE_BACKEND_API_REQUEST, eventPayload);

    return fetch(url, payload).then(resp => { return resp.json() })
  },
  async createBraintreeClient ({ state, commit, dispatch }): Promise<Client> {
    const date = Date.now()
    if (state.braintreeClient && state.expirationDate && date < state.expirationDate) {
      return state.braintreeClient;
    }

    if (state.braintreeClientCreationPromise) {
      return state.braintreeClientCreationPromise;
    }

    commit(SET_BRAINTREE_CLIENT, undefined);
    commit(SET_BRAINTREE_CLIENT_EXPIRATION_DATE, undefined);

    const braintreeClientCreationPromise = async (): Promise<Client> => {
      try {
        const token = await dispatch('generateToken');
        const braintreeClient = await client.create({
          authorization: token
        });

        commit(SET_BRAINTREE_CLIENT, braintreeClient);
        commit(SET_BRAINTREE_CLIENT_EXPIRATION_DATE, date + BRAINTREE_CLIENT_EXPIRATION_TIMEOUT);

        return braintreeClient;
      } finally {
        commit(SET_BRAINTREE_CLIENT_CREATION_PROMISE, undefined)
      }
    };

    const promise = braintreeClientCreationPromise()

    commit(SET_BRAINTREE_CLIENT_CREATION_PROMISE, promise);

    return promise;
  },
  async ensurePayPalSdkLoaded (
    { state, commit, dispatch },
    { currency }: { currency?: string } = {}
  ): Promise<void> {
    if (isServer) {
      return;
    }

    if (state.isPayPalSdkLoaded) {
      return;
    }

    if (state.paypalSdkLoadPromise) {
      return state.paypalSdkLoadPromise;
    }

    const loadPromise = (async (): Promise<void> => {
      try {
        const braintreeClient: Client = await dispatch('createBraintreeClient');

        let checkoutInstance = state.paypalCheckoutInstance;

        if (!checkoutInstance) {
          checkoutInstance = await paypalCheckout.create({ client: braintreeClient });
          commit(SET_PAYPAL_CHECKOUT_INSTANCE, checkoutInstance);
        }

        await checkoutInstance.loadPayPalSDK({
          currency,
          components: 'buttons,messages',
          intent: 'capture',
          'enable-funding': 'paylater'
        });

        commit(SET_IS_PAYPAL_SDK_LOADED, true);
      } finally {
        commit(SET_PAYPAL_SDK_LOAD_PROMISE, undefined);
      }
    })();

    commit(SET_PAYPAL_SDK_LOAD_PROMISE, loadPromise);

    return loadPromise;
  }
}
