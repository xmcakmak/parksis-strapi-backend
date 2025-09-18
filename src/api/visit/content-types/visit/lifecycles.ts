export default {
  beforeCreate(event) {
    // event.params.data objesi, oluşturulmakta olan veriyi içerir.
    // Eğer timestamp alanı daha önceden (örneğin API isteğiyle) atanmamışsa,
    // o anki zamanı ata.
    if (!event.params.data.timestamp) {
      event.params.data.timestamp = new Date().toISOString();
    }
  },
};
