export default () => {
  return async (ctx, next) => {
    const allowedIps = ["161.35.196.121", "167.172.173.251", "46.1.83.40", "46.1.136.240", "212.156.10.22"];
    const requestIp = ctx.request.ip;

    // For local testing, you might want to allow localhost IPs
    if (['127.0.0.1', '::1'].includes(requestIp)) {
      return await next();
    }

    if (allowedIps.includes(requestIp)) {
      await next(); // IP is allowed, proceed
    } else {
      // IP is not allowed, throw a Forbidden error
      return ctx.forbidden('This IP is not allowed to access this endpoint.');
    }
  };
};
