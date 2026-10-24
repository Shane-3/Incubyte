import { type RequestHandler, Router } from 'express';
import type { createVehicleController } from '../controllers/vehicle.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import {
  createVehicleSchema,
  purchaseSchema,
  restockSchema,
  searchQuerySchema,
  updateVehicleSchema,
  vehicleIdSchema,
} from '../validators/vehicle.schemas';

interface Guards {
  authenticate: RequestHandler;
  adminOnly: RequestHandler;
}

export function vehicleRoutes(controller: ReturnType<typeof createVehicleController>, guards: Guards) {
  const router = Router();
  // Deny by default: every vehicle route, including ones added later, requires a session.
  router.use(guards.authenticate);

  router.get('/', validateQuery(searchQuerySchema), controller.search);
  // Static paths are registered before /:id so they are never captured as an id.
  router.get('/search', validateQuery(searchQuerySchema), controller.search);
  router.get('/forecast', guards.adminOnly, controller.forecast);
  router.post('/', validateBody(createVehicleSchema), controller.create);
  router.put('/:id', validateParams(vehicleIdSchema), validateBody(updateVehicleSchema), controller.update);
  router.post('/:id/purchase', validateParams(vehicleIdSchema), validateBody(purchaseSchema), controller.purchase);
  router.post(
    '/:id/restock',
    guards.adminOnly,
    validateParams(vehicleIdSchema),
    validateBody(restockSchema),
    controller.restock,
  );
  router.delete('/:id', guards.adminOnly, validateParams(vehicleIdSchema), controller.remove);
  return router;
}
