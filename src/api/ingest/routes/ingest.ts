export default {
  routes: [
    {
      method: 'POST',
      path: '/ingest',
      handler: 'ingest.log',
      config: {
        auth: false, // Authentication'ı devre dışı bırakıyoruz, IP filtresini middleware ile yapacağız
        middlewares: ['global::ip-whitelist'],
      },
    },
  ],
};
