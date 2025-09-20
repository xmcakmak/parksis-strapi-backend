
export default {
  routes: [
    // --- Routes for FULL data seeding (deletes everything) ---
    {
      method: 'POST',
      path: '/data-seeder/full-seed/success',
      handler: 'data-seeder.runFullSuccessScenario',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/data-seeder/full-seed/failure',
      handler: 'data-seeder.runFullFailureScenario',
      config: {
        auth: false,
      },
    },

    // --- Routes for generating VISITS ONLY (preserves other data) ---
    {
      method: 'POST',
      path: '/data-seeder/generate-visits/success',
      handler: 'data-seeder.generateSuccessVisits',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/data-seeder/generate-visits/failure',
      handler: 'data-seeder.generateFailureVisits',
      config: {
        auth: false,
      },
    },
  ],
};
