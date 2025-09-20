export default {
  routes: [
    {
      method: 'GET',
      path: '/reports/project/:projectId',
      handler: 'report.getProjectReport',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
