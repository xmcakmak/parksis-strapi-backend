const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Dünya yarıçapı (metre)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // metre cinsinden mesafe
};

export default {
  async log(ctx) {
    try {
      const incomingData = ctx.request.body as any;
      console.log('Received data on /api/ingest:', incomingData);

      if (!incomingData || !incomingData.loc_cihaz_id) {
        return ctx.badRequest('Device ID (loc_cihaz_id) is missing.');
      }

      // Cihaz proxy mantığı
      let deviceCode = incomingData.loc_cihaz_id;
      if (deviceCode === "5431234567") {
        deviceCode = "5313825282";
      }

      // 1. Cihazı ve bağlı olduğu projeyi bul
      const devices = await strapi.entityService.findMany('api::device.device', {
        filters: { code: deviceCode },
        populate: { project: true },
      });

      if (devices.length === 0) {
        return ctx.notFound(`Device with code ${deviceCode} not found.`);
      }
      const device = devices[0];
      const projectId = (device as any).project?.id;

      if (!projectId) {
        return ctx.badRequest(`Device ${deviceCode} is not associated with any project.`);
      }

      // 2. Projeye ait tüm checkpoint'leri al
      const checkpoints = await strapi.entityService.findMany('api::checkpoint.checkpoint', {
        filters: { project: projectId, isDeleted: false },
      });

      if (checkpoints.length === 0) {
        return ctx.badRequest(`No checkpoints found for project ID ${projectId}.`);
      }

      // 3. En yakın checkpoint'i bul
      let minDistance = Infinity;
      let closestCheckpoint = null;

      for (const checkpoint of checkpoints) {
        const distance = haversineDistance(
          incomingData.loc_lat,
          incomingData.loc_lng,
          checkpoint.latitude,
          checkpoint.longitude
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestCheckpoint = checkpoint;
        }
      }

      // 4. Yeni Visit verisini hazırla ve kaydet
      const visitData = {
        device: device.id,
        project: projectId,
        latitude: incomingData.loc_lat,
        longitude: incomingData.loc_lng,
        status: incomingData.loc_status || 0,
        timestamp: incomingData.loc_time ? new Date(incomingData.loc_time).toISOString() : new Date().toISOString(),
        checkpoint: (minDistance < 50 && closestCheckpoint) ? closestCheckpoint.id : null,
        distance: (minDistance < 50 && closestCheckpoint) ? Math.round(minDistance) : 0,
        publishedAt: new Date(),
      };

      const entry = await strapi.entityService.create('api::visit.visit', { data: visitData as any });

      return { success: true, created: entry };

    } catch (err) {
      ctx.response.status = 500;
      console.error('Ingest error:', err);
      return { success: false, error: err.message };
    }
  }
};
