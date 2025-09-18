export default {
  async getProjectReport(ctx) {
    try {
      const { projectId } = ctx.params;
      const { start_date, end_date } = ctx.query;

      let startTime, endTime;

      // Tarih aralığı kontrolü
      if (start_date && end_date) {
        startTime = new Date(start_date as string);
        endTime = new Date(end_date as string);
      } else {
        const twelveHoursInMs = 12 * 3600 * 1000;
        endTime = new Date();
        startTime = new Date(endTime.getTime() - twelveHoursInMs);
      }

      // 1. Periyot bilgileriyle birlikte projenin tüm checkpoint'lerini al
      const checkpoints = await strapi.entityService.findMany('api::checkpoint.checkpoint', {
        filters: { project: projectId, isDeleted: false },
        populate: { period: true },
      });

      const reportData = [];

      // 2. Her bir checkpoint için durumu analiz et
      for (const checkpoint of checkpoints) {
        let statusText = '';
        let statusClass = '';
        let disruptions = [];
        let totalDisruptionCount = 0;

        const periodSeconds = (checkpoint as any).period?.duration_seconds;

        if (!periodSeconds || periodSeconds <= 0) {
          statusText = 'Periyot Tanımsız';
          statusClass = 'info';
        } else {
          // Belirtilen aralıktaki tüm ziyaretleri al
          const visits = await strapi.entityService.findMany('api::visit.visit', {
            filters: {
              checkpoint: { id: checkpoint.id },
              timestamp: {
                $gte: startTime.toISOString(),
                $lte: endTime.toISOString(),
              },
            },
            sort: { timestamp: 'asc' },
          });

          const visitTimestamps = visits.map(visit => new Date(visit.timestamp).getTime());

          // KONTROL MANTIĞI:
          const controlTimestamps = [
            startTime.getTime(),
            ...visitTimestamps,
            endTime.getTime(),
          ];

          for (let i = 0; i < controlTimestamps.length - 1; i++) {
            const timeDiff = (controlTimestamps[i + 1] - controlTimestamps[i]) / 1000; // saniyeye çevir

            if (timeDiff > periodSeconds) {
              const disruptionCount = Math.floor(timeDiff / periodSeconds);
              totalDisruptionCount += disruptionCount;
              const disruptionStart = new Date(controlTimestamps[i]).toLocaleString();
              const disruptionEnd = new Date(controlTimestamps[i + 1]).toLocaleString();
              disruptions.push(`(${disruptionStart} - ${disruptionEnd} aralığında ${disruptionCount} ziyaret aksaması)`);
            }
          }

          if (disruptions.length > 0) {
            statusText = 'Periyot Aksatılmış';
            statusClass = 'danger';
          } else {
            statusText = 'Ziyaretler Tamam';
            statusClass = 'success';
          }
        }

        reportData.push({
          checkpoint_name: checkpoint.name,
          checkpoint_period: (checkpoint as any).period?.name || 'Tanımsız',
          status_text: statusText,
          disruptions: disruptions,
          total_disruption_count: totalDisruptionCount,
          status_class: statusClass,
        });
      }

      return { data: reportData };

    } catch (err) {
      ctx.response.status = 500;
      console.error('Error in getProjectReport:', err);
      return { error: { message: 'An error occurred while generating the report.', details: err.message } };
    }
  },
};
