import type { Request, Response } from 'express';
import type { ForecastService } from '../services/forecast.service';
import type { VehicleService } from '../services/vehicle.service';
import type { WatchService } from '../services/watch.service';
import type {
  CreateVehicleBody,
  PurchaseBody,
  RestockBody,
  SearchQuery,
  UpdateVehicleBody,
} from '../validators/vehicle.schemas';

export function createVehicleController(vehicles: VehicleService, forecasts: ForecastService, watches: WatchService) {
  return {
    async forecast(_req: Request, res: Response) {
      res.json(await forecasts.report());
    },

    async stats(_req: Request, res: Response) {
      res.json(await vehicles.stats());
    },

    async create(req: Request, res: Response) {
      const vehicle = await vehicles.create(req.body as CreateVehicleBody);
      res.status(201).json({ vehicle });
    },

    async search(req: Request, res: Response) {
      const { sort, order, limit, offset, ...filters } = res.locals.query as SearchQuery;
      res.json(await vehicles.search(filters, { sort, order, limit, offset }, req.user!.id));
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

    async watch(req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      await watches.watch(req.user!.id, id);
      res.json({ watching: true });
    },

    async unwatch(req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      await watches.unwatch(req.user!.id, id);
      res.status(204).end();
    },

    async remove(_req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      await vehicles.remove(id);
      res.status(204).end();
    },
  };
}
