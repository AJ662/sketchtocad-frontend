// Empty string = relative URLs. Works with GKE Ingress routing /api/* to api-gateway
const GATEWAY_URL = '';

export const API_CONFIG = {
  workflow: {
    baseUrl: `${GATEWAY_URL}/api/v1/workflow`,
    endpoints: {
      start: '/start',
      status: '/:sagaId'
    }
  },
  imageProcessing: {
    baseUrl: `${GATEWAY_URL}/api/v1/image-processing`,
    endpoints: {
      processImage: '/process-image',
      getSession: '/session',
      deleteSession: '/session',
      health: '/health'
    }
  },
  clustering: {
    baseUrl: `${GATEWAY_URL}/api/v1/clustering`,
    endpoints: {
      createEnhancedColors: '/create-enhanced-colors',
      processClustering: '/process-clustering',
      health: '/health'
    }
  },
  dxfExport: {
    baseUrl: `${GATEWAY_URL}/api/v1/dxf-export`,
    endpoints: {
      exportDxf: '/export-dxf',
      validateExport: '/validate-export',
      health: '/health',
      capabilities: '/capabilities'
    }
  }
};

export default API_CONFIG;