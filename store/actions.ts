import braintree from 'braintree-web';
import config from 'config'
import { adjustMultistoreApiUrl } from '@vue-storefront/core/lib/multistore'
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'

import { BraintreeState } from '../types/BraintreeState'
import { ActionTree } from 'vuex';
import { BEFORE_FETCH } from 'src/modules/shared';

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

    EventBus.$emit(BEFORE_FETCH, payload);

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

    EventBus.$emit(BEFORE_FETCH, payload);

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

    EventBus.$emit(BEFORE_FETCH, payload);

    return fetch(url, payload).then(resp => { return resp.json() })
  },
  async createBraintreeClient ({ dispatch }): Promise<braintree.Client> {
    const token = await dispatch('generateToken');
    const braintreeClient = await braintree.client.create({
      authorization: token
    });

    return braintreeClient;
  }
}
