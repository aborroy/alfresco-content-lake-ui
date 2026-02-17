/**
 * Proxy snippet for ACA development server.
 *
 * Add the '/api/rag' block to your existing `app/proxy.conf.js`.
 * Adjust the target to wherever rag-service is running.
 *
 */
module.exports = {

  // --- existing ACA proxy entries --------------------------------
  // '/alfresco': { target: 'http://localhost:8080', ... },

  // --- RAG service -----------------------------------------------
  '/api/rag': {
    target: 'http://localhost:9091',
    changeOrigin: true,
    secure: false,
    logLevel: 'debug',
  }

};
