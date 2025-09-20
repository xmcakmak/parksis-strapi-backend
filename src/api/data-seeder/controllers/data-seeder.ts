import { faker } from '@faker-js/faker';

export default {
  async run(ctx) {
    try {
      // 1. Tüm verileri sil
      await strapi.db.query('api::visit.visit').deleteMany({});
      await strapi.db.query('api::device.device').deleteMany({});
      await strapi.db.query('api::checkpoint.checkpoint').deleteMany({});
      await strapi.db.query('api::period.period').deleteMany({});
      await strapi.db.query('api::project.project').deleteMany({});
      await strapi.db.query('api::firm.firm').deleteMany({});

      // 2. Firma ekle
      const firm = await strapi.entityService.create('api::firm.firm', {
        data: { name: 'TEKMER SELALE', publishedAt: new Date() },
      });

      // 3. Proje ekle
      const project = await strapi.entityService.create('api::project.project', {
        data: {
          name: 'Güvenlik',
          latitude: 40.8590341,
          longitude: 29.3162565,
          firm: firm.id,
          publishedAt: new Date(),
        },
      });

      // 4. Kontrol noktalarını ekle
      const checkpointsData = [
        { name: 'Merkez', latitude: 40.85902364102, longitude: 29.316840338888 },
        { name: 'Kutup', latitude: 40.858406939973, longitude: 29.316330719175 },
        { name: 'Giris', latitude: 40.859628164763, longitude: 29.31726949233 },
      ];
      const checkpoints = [];
      for (const cp of checkpointsData) {
        const checkpoint = await strapi.entityService.create('api::checkpoint.checkpoint', {
          data: { ...cp, project: project.id, publishedAt: new Date() },
        });
        checkpoints.push(checkpoint);
      }

      // 5. Periyotları ekle
      const periodsData = [
        { name: '15 dakika', duration_seconds: 900 },
        { name: '30 dakika', duration_seconds: 1800 },
        { name: '45 dakika', duration_seconds: 2700 },
        { name: '1 saat', duration_seconds: 3600 },
        { name: '2 saat', duration_seconds: 7200 }
      ];
      const periods = [];
      for (const p of periodsData) {
        const period = await strapi.entityService.create('api::period.period', {
          data: {
            name: p.name,
            duration_seconds: p.duration_seconds,
            project: project.id,
            publishedAt: new Date(),
          },
        });
        periods.push(period);
      }

      // 6. Cihaz ekle
      const device = await strapi.entityService.create('api::device.device', {
        data: {
          name: 'Güvenlik Cihazı',
          code: '5551234567',
          firm: firm.id,
          project: project.id,
          publishedAt: new Date(),
        },
      });

      // 7. 50 ziyaret kaydı oluştur
      for (let i = 0; i < 50; i++) {
        // Rastgele bir checkpoint seç
        const cp = checkpoints[Math.floor(Math.random() * checkpoints.length)];
        // Checkpoint'e yakın bir konum üret
        const lat = cp.latitude + (Math.random() - 0.5) * 0.0002;
        const lon = cp.longitude + (Math.random() - 0.5) * 0.0002;
        // Zamanı rastgele seç (son 2 gün içinde)
        const timestamp = faker.date.recent({ days: 2 });

        await strapi.entityService.create('api::visit.visit', {
          data: {
            device: { id: device.id },
            checkpoint: cp.id,
            latitude: lat,
            longitude: lon,
            timestamp,
            project: project.id,
            visit_status: false, // veya true, senaryoya göre
            publishedAt: new Date(),
          },
        });
      }

      ctx.body = {
        message: 'Seed işlemi tamamlandı.',
        firm,
        project,
        checkpoints,
        device,
      };
    } catch (err) {
      ctx.response.status = 500;
      console.error('Data seeder error:', err);
      ctx.body = { success: false, error: err.message };
    }
  },
};
