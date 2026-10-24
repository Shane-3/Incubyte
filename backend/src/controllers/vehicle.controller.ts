import type { Request, Response } from 'express';
import type { VehicleService } from '../services/vehicle.service';
import type {
  CreateVehicleBody,
  PurchaseBody,
  RestockBody,
  SearchQuery,
  UpdateVehicleBody,
} from '../validators/vehicle.schemas';

export function createVehicleController(vehicles: VehicleService) {
  return {
    async create(req: Request, res: Response) {
      const vehicle = await vehicles.create(req.body as CreateVehicleBody);
      res.status(201).json({ vehicle });
    },

    async search(_req: Request, res: Response) {
      const { sort, order, limit, offset, ...filters } = res.locals.query as SearchQuery;
      res.json(await vehicles.search(filters, { sort, order, limit, offset }));
    },

    async update(req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      const vehicle = await vehicles.update(id, req.body as UpdateVehicleBody);
      res.json({ vehicle });
    },

    async purchase(req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      const { quantity } = req.body as PurchaseBody;
      res.json({ vehicle: await vehicles.purchase(id, req.user!.id, quantity) });
    },

    async restock(req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      const { quantity } = req.body as RestockBody;
      res.json({ vehicle: await vehicles.restock(id, quantity) });
    },

    async remove(_req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      await vehicles.remove(id);
      res.status(204).end();
    },
  };
}
