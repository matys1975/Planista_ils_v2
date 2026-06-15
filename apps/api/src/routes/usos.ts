import { FastifyInstance } from 'fastify';
import { USOSExportService } from '../services/usos/exportService';
import { USOSClient } from '../services/usos/usosClient';

export default async function usosRoutes(fastify: FastifyInstance) {
  const exportService = new USOSExportService();
  const client = new USOSClient();

  /**
   * Punkt kontrolny integracji USOS
   */
  fastify.get('/api/v1/usos/status', async () => {
    try {
      const methods = await client.getAvailableMethods();
      return { 
        status: 'ok', 
        connected: true, 
        message: 'Połączono z USOS API',
        methodCount: methods?.length || 0 
      };
    } catch (error: any) {
      return { 
        status: 'error', 
        connected: false, 
        message: error.message 
      };
    }
  });

  /**
   * Wyzwalacz eksportu planu dla semestru
   */
  fastify.post('/api/v1/usos/export/:semesterId', async (request: any, reply) => {
    const { semesterId } = request.params;
    
    try {
      const results = await exportService.exportSemesterPlan(semesterId);
      return results;
    } catch (error: any) {
      return reply.code(500).send({ 
        error: 'Export failed', 
        message: error.message 
      });
    }
  });
}
