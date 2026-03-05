import { add } from 'src/modules/vsf-storyblok-module/components';

export default function registerStoryblokComponents () {
  console.log('register');
  add('paypal_pay_later_message', () => import(/* webpackChunkName: "vsf-braintree-storyblok-components" */ './PayPalPayLaterMessaging.vue'));
}
