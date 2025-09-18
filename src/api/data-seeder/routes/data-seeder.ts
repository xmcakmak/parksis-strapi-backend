export default {
  routes: [
    {
      method: 'POST',
      path: '/data-seeder/run',
      handler: 'data-seeder.run',
      config: {
        auth: false, // Bu endpoint'i test için herkese açık yapalım
      },
    },
  ],
};
