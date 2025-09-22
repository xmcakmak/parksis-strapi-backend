// Helper function to calculate distance between two geo-coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return +(R * c).toFixed(1); // in metres, 1 ondalık basamak
};

// --- FULL SEED SCENARIO --- 
// Deletes everything and creates a full dataset from scratch
const executeFullSeedScenario = async (scenario: 'success' | 'failure') => {
  console.log(`Starting FULL data seed for scenario: ${scenario}`);

  // 1. Clean up ALL data
  await strapi.db.query('api::visit.visit').deleteMany({});
  await strapi.db.query('api::device.device').deleteMany({});
  await strapi.db.query('api::checkpoint.checkpoint').deleteMany({});
  await strapi.db.query('api::period.period').deleteMany({});
  await strapi.db.query('api::project.project').deleteMany({});
  await strapi.db.query('api::firm.firm').deleteMany({});

  // 2. Create Firm, Project, Periods
  const firm = await strapi.entityService.create('api::firm.firm', { data: { name: 'TEKMER SELALE', publishedAt: new Date() } });
  const project = await strapi.entityService.create('api::project.project', { data: { name: 'Güvenlik', latitude: 40.8590341, longitude: 29.3162565, firm: firm.id, publishedAt: new Date() } });
  const periodsData = [{ name: '15 dakika', duration_seconds: 900 },{ name: '30 dakika', duration_seconds: 1800 }, { name: '1 saat', duration_seconds: 3600 }, { name: '2 saat', duration_seconds: 7200 }];
  const periodMap = new Map();
  for (const p of periodsData) {
    const period = await strapi.entityService.create('api::period.period', { data: { ...p, publishedAt: new Date() } });
    periodMap.set(p.name, period);
  }

  // 3. Create Checkpoints
  const checkpointsData = [
    { name: 'Merkez', latitude: 40.85902364102, longitude: 29.316840338888, periodName: '2 saat' },
    { name: 'Kutup', latitude: 40.858406939973, longitude: 29.316330719175, periodName: '30 dakika' },
    { name: 'Giris', latitude: 40.859628164763, longitude: 29.31726949233, periodName: '1 saat' },
  ];
  const checkpointsWithPeriods = [];
  for (const cpData of checkpointsData) {
    const period = periodMap.get(cpData.periodName);
    if (!period) continue;
    const checkpoint = await strapi.entityService.create('api::checkpoint.checkpoint', { data: { name: cpData.name, latitude: cpData.latitude, longitude: cpData.longitude, project: project.id, period: period.id, publishedAt: new Date() } });
    checkpointsWithPeriods.push({ ...checkpoint, period_duration_seconds: period.duration_seconds });
  }

  // 4. Create Device
  const device = await strapi.entityService.create('api::device.device', { data: { name: 'Güvenlik Cihazı', code: '5551234567', firm: firm.id, project: project.id, publishedAt: new Date() } });

  // 5. Generate Visits, passing the projectId explicitly
  await generateVisits(scenario, device, checkpointsWithPeriods, project.id);

  return { message: `Full seed işlemi tamamlandı. Senaryo: ${scenario}` };
};

// --- VISIT GENERATION LOGIC --- 
// Deletes only visits and generates new ones for a specific device and its checkpoints.
const generateVisitsOnly = async (scenario: 'success' | 'failure') => {
  console.log(`Starting VISIT-ONLY generation for scenario: ${scenario}`);

  // 1. Find the specific device and its project
  const device = await strapi.db.query('api::device.device').findOne({ where: { code: '5551234567' }, populate: ['project'] });
  if (!device) throw new Error('Device with code 5551234567 not found.');
  
  // Defensively get the project ID, whether it's an object or a direct ID
  const projectId = typeof device.project === 'object' && device.project !== null ? device.project.id : device.project;
  if (!projectId) {
    throw new Error(`Device ${device.code} is not associated with a project or project ID is invalid.`);
  }

  // 2. Find checkpoints for that project
  const checkpoints = await strapi.db.query('api::checkpoint.checkpoint').findMany({ where: { project: projectId }, populate: ['period'] });
  if (!checkpoints || checkpoints.length === 0) throw new Error(`No checkpoints found for project ${projectId}.`);

  const checkpointsWithPeriods = checkpoints.map(cp => ({ ...cp, period_duration_seconds: cp.period?.duration_seconds })).filter(cp => cp.period_duration_seconds);
  if (checkpointsWithPeriods.length === 0) throw new Error('None of the found checkpoints have an associated period with a duration.');

  // 3. Delete only existing visits
  console.log('Deleting old visits...');
  await strapi.db.query('api::visit.visit').deleteMany({});

  // 4. Generate new visits, passing the projectId explicitly
  const result = await generateVisits(scenario, device, checkpointsWithPeriods, projectId);

  return { message: `Visit-only generation tamamlandı. Senaryo: ${scenario}`, visits_created: result.visits_created };
}

// --- CORE VISIT CREATION ENGINE (Takes projectId as an argument) ---
async function generateVisits(scenario, device, checkpointsWithPeriods, projectId) {
  console.log(`Generating visits with chained-interval logic for scenario: ${scenario}...`);
  let totalVisitsCreated = 0;

  for (const cp of checkpointsWithPeriods) {
    const periodInSeconds = cp.period_duration_seconds;
    if (!periodInSeconds) continue;

    const simulationEndTime = new Date();
    // Start the chain 24 hours ago
    let lastVisitTime = new Date(simulationEndTime.getTime() - 24 * 60 * 60 * 1000);

    // Keep creating visits until we reach the present time
    while (lastVisitTime < simulationEndTime) {
      let intervalSeconds;

      if (scenario === 'failure' && Math.random() < 0.3) {
        // For failure, the interval is LONGER than the period
        intervalSeconds = periodInSeconds + (Math.random() * periodInSeconds * 0.5);
      } else {
        // For success, the interval is SHORTER than the period
        intervalSeconds = (Math.random() * 0.9 + 0.05) * periodInSeconds;
      }

      const newVisitTime = new Date(lastVisitTime.getTime() + intervalSeconds * 1000);

      if (newVisitTime > simulationEndTime) {
        break;
      }

      const lat = cp.latitude + (Math.random() - 0.5) * 0.0001;
      const lon = cp.longitude + (Math.random() - 0.5) * 0.0001;
      const distance = calculateDistance(cp.latitude, cp.longitude, lat, lon);

      await strapi.entityService.create('api::visit.visit', {
        data: {
          device: device.id,
          checkpoint: cp.id,
          project: projectId, // Use the passed projectId
          latitude: lat,
          longitude: lon,
          timestamp: newVisitTime,
          distance: distance,
          visit_status: distance <= 50,
          publishedAt: new Date(),
        },
      });
      totalVisitsCreated++;

      // The next visit is chained to the one just created
      lastVisitTime = newVisitTime;
    }
  }

  console.log(`${totalVisitsCreated} visits generated.`);
  return { visits_created: totalVisitsCreated };
}

export default {
  // --- Full Seed Endpoints ---
  async runFullSuccessScenario(ctx) {
    try {
      const result = await executeFullSeedScenario('success');
      ctx.body = result;
    } catch (err) {
      ctx.response.status = 500;
      ctx.body = { success: false, error: err.message };
    }
  },
  async runFullFailureScenario(ctx) {
    try {
      const result = await executeFullSeedScenario('failure');
      ctx.body = result;
    } catch (err) {
      ctx.response.status = 500;
      ctx.body = { success: false, error: err.message };
    }
  },

  // --- Visit-Only Generation Endpoints ---
  async generateSuccessVisits(ctx) {
    try {
      const result = await generateVisitsOnly('success');
      ctx.body = result;
    } catch (err) {
      ctx.response.status = 500;
      ctx.body = { success: false, error: err.message };
    }
  },
  async generateFailureVisits(ctx) {
    try {
      const result = await generateVisitsOnly('failure');
      ctx.body = result;
    } catch (err) {
      ctx.response.status = 500;
      ctx.body = { success: false, error: err.message };
    }
  },
};