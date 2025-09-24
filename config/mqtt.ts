export default {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  topic: process.env.MQTT_TOPIC || 'takipteyim',
  options: {
    clientId: process.env.MQTT_CLIENT_ID || 'strapi_mqtt_client',
    // Add other MQTT client options here, e.g., keepalive, reconnectPeriod
    keepalive: 60,
    reconnectPeriod: 1000, // reconnect every 1s
  },
};