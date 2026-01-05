// In production (GKE), use relative URL. In development, use localhost
const GATEWAY_URL = process.env.NODE_ENV === 'production'
  ? ''
  : (process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:8000');

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