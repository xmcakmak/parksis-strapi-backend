import mqttListener from './services/mqtt-listener';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {
    mqttListener.connectMqtt();
  },

  /**
   * An asynchronous destroy function that runs when
   * your application is shutting down.
   *
   * This gives you an opportunity to clean up resources.
   */
  destroy(/* { strapi }: { strapi: Core.Strapi } */) {
    mqttListener.disconnectMqtt();
  },
};