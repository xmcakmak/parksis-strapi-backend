export default {
  async run(ctx) {
    try {
      const { 
        scenario = 'successful', 
        checkpointId = 1, 
        recordCount = 50 
      } = (ctx.request.body || {}) as any;

      // 1. İlgili checkpoint'i ve periyodunu bul
      const checkpoint = await strapi.entityService.findOne('api::checkpoint.checkpoint', checkpointId, {
        populate: { period: true },
      });

      if (!checkpoint) {
        return ctx.badRequest(`Checkpoint with ID ${checkpointId} not found.`);
      }

      const periodSeconds = (checkpoint as any).period?.duration_seconds;
      if (!periodSeconds) {
        return ctx.badRequest(`Period is not defined for checkpoint ID ${checkpointId}.`);
      }
      
      // 2. O checkpoint'e ait eski Visit kayıtlarını temizle (Doğru yöntem: strapi.db.query)
      await strapi.db.query('api::visit.visit').delete({
        where: { checkpoint: checkpointId },
      });

      // 3. Rastgele bir cihaz seç (test için ilk bulduğunu al)
      const devices = await strapi.entityService.findMany('api::device.device', { limit: 1 });
      if (devices.length === 0) {
        return ctx.badRequest('No devices found in the system to create visits.');
      }
      const deviceId = devices[0].id;

      // 4. Yeni Visit kayıtlarını oluştur
      let lastTimestamp = new Date();

      for (let i = 0; i < recordCount; i++) {
        let interval = 0;
        if (scenario === 'successful') {
          const minInterval = periodSeconds * 0.7;
          const maxInterval = periodSeconds * 0.95;
          interval = Math.floor(Math.random() * (maxInterval - minInterval + 1) + minInterval);
        } else if (scenario === 'failed' && (i > 0 && i % 10 === 0)) { // Her 10 kayıtta bir aksama yap
          interval = periodSeconds * 2;
        } else {
          const minInterval = periodSeconds * 0.7;
          const maxInterval = periodSeconds * 0.95;
          interval = Math.floor(Math.random() * (maxInterval - minInterval + 1) + minInterval);
        }

        const newTimestamp = new Date(lastTimestamp.getTime() - interval * 1000);
        
        const visitData = {
          device: deviceId,
          latitude: checkpoint.latitude,
          longitude: checkpoint.longitude,
          status: 0, // Hata mesajına göre bu alanın adı farklı olabilir, gerekirse düzeltiriz.
          timestamp: newTimestamp.toISOString(),
          checkpoint: checkpointId,
          distance: Math.floor(Math.random() * 20 + 1), // 1-20m arası rastgele mesafe
          publishedAt: new Date(), // Taslak olarak değil, direkt yayınla
        };

        // Hata mesajına göre 'status' alanını 'visit_status' olarak deniyoruz.
        // Eğer alan adı farklıysa, burayı tekrar düzenlememiz gerekebilir.
        const correctedVisitData = { ...visitData, visit_status: visitData.status };
        delete correctedVisitData.status;


        await strapi.entityService.create('api::visit.visit', { data: correctedVisitData as any });
        
        lastTimestamp = newTimestamp;
      }

      const message = `${recordCount} visit records were generated for checkpoint ID ${checkpointId} with scenario: '${scenario}'.`;
      return { success: true, message };

    } catch (err) {
      ctx.response.status = 500;
      console.error('Data seeder error:', err);
      return { success: false, error: err.message };
    }
  }
};
