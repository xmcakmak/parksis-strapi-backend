import mqtt from 'mqtt';
import mqttConfig from '../../config/mqtt';


let client: mqtt.MqttClient | null = null;

const connectMqtt = () => {
  if (client && client.connected) {
    console.log('MQTT client already connected.');
    return;
  }

  console.log(`Attempting to connect to MQTT broker: ${mqttConfig.brokerUrl} with client ID: ${mqttConfig.options.clientId}`);
  client = mqtt.connect(mqttConfig.brokerUrl, mqttConfig.options);

  client.on('connect', () => {
    console.log('Connected to MQTT broker.');
    client?.subscribe(mqttConfig.topic, (err) => {
      if (!err) {
        console.log(`Subscribed to topic: ${mqttConfig.topic}`);
      } else {
        console.error(`Failed to subscribe to topic ${mqttConfig.topic}:`, err);
      }
    });
  });

  client.on('message', async (topic, message) => {
    console.log(`Received message on topic ${topic}: ${message.toString()}`);
    try {
      const rawMessage = message.toString();
      const parts = rawMessage.split(' ');

      if (parts.length !== 4) {
        console.warn('MQTT message has incorrect number of parts (expected 4).', { rawMessage });
        return;
      }

      const [telnoId, latStr, lngStr, locStatusStr] = parts;

      const latitude = parseFloat(latStr.split(':')[1]);
      const longitude = parseFloat(lngStr.split(':')[1]);
      const locStatus = locStatusStr.split(':')[1];

      if (isNaN(latitude) || isNaN(longitude)) {
        console.warn('MQTT message: latitude or longitude are not valid numbers.', { rawMessage, latitude, longitude });
        return;
      }

      // Filter based on loc_status as per user's previous snippet
      if (locStatus !== '0') {
        console.log(`MQTT message loc_status is not '0'. Skipping visit creation.`, { rawMessage, locStatus });
        return;
      }

      // Find the device by code
      const device = await strapi.db.query('api::device.device').findOne({ where: { code: telnoId }, populate: ['project'] });
      if (!device) {
        console.warn(`Device with code ${telnoId} not found. Skipping visit creation.`, { rawMessage });
        return;
      }
      if (!device.project) {
        console.warn(`Device ${telnoId} is not associated with a project. Skipping visit creation.`, { rawMessage });
        return;
      }

      // Find all checkpoints for the device's project to determine the closest one
      const checkpoints = await strapi.db.query('api::checkpoint.checkpoint').findMany({ where: { project: device.project.id } });
      if (!checkpoints || checkpoints.length === 0) {
        console.warn(`No checkpoints found for project ${device.project.id}. Skipping visit creation.`, { rawMessage });
        return;
      }

      let closestCheckpoint = null;
      let minDistance = Infinity;

      for (const cp of checkpoints) {
        const dist = strapi.service('api::geo.geo').calculateDistance(cp.latitude, cp.longitude, latitude, longitude);
        if (dist < minDistance) {
          minDistance = dist;
          closestCheckpoint = cp;
        }
      }

      if (!closestCheckpoint) {
        console.warn(`Could not determine closest checkpoint for device ${telnoId}. Skipping visit creation.`, { rawMessage });
        return;
      }

      // Create visit record
      await strapi.entityService.create('api::visit.visit', {
        data: {
          device: device.id,
          checkpoint: closestCheckpoint.id,
          project: device.project.id,
          latitude: latitude,
          longitude: longitude,
          timestamp: new Date(), // Use current time as timestamp is not in MQTT message
          distance: minDistance,
          visit_status: minDistance <= 50, // Example: within 50m is successful
          publishedAt: new Date(),
        },
      });
      console.log('Visit record created from MQTT message.', { deviceCode: telnoId, checkpointName: closestCheckpoint.name, distance: minDistance.toFixed(2) });

    } catch (error) {
      console.error('Error processing MQTT message:', { error, topic, message: message.toString() });
    }
  });

  client.on('error', (err) => {
    console.error('MQTT client error:', err);
  });

  client.on('close', () => {
    console.log('MQTT client disconnected.');
  });

  client.on('reconnect', () => {
    console.log('MQTT client attempting to reconnect...');
  });
};

const disconnectMqtt = () => {
  if (client && client.connected) {
    client.end(false, () => {
      client = null;
      console.log('MQTT client disconnected gracefully.');
    });
  } else if (client) {
    client.end(); // Ensure client is ended even if not connected
    client = null;
  }
};

export default {
  connectMqtt,
  disconnectMqtt,
};
