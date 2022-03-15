import { Logger } from '@vue-storefront/core/lib/logger'
import { StorageManager } from '@vue-storefront/core/lib/storage-manager'

import { SET_SELECTED_METHOD, SN_BRAINTREE } from './mutation-types'

export function plugin (mutation, state) {
  if (mutation.type.endsWith(SET_SELECTED_METHOD)) {
    return StorageManager
      .get(SN_BRAINTREE)
      .setItem('selected-method', state.braintree.selectedMethod)
      .catch((reason) => {
        Logger.error(reason)();
      })
  }
}
