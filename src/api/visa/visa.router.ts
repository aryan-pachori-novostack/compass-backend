import { Router, type Request, type Response } from 'express';
import visa_service from '../../modules/visa/visa.service.js';
import { auth_guard } from '../../middlewares/auth_guard.js';

const visa_router = Router();

// GET /visa/:country_id - Get visa types with fees and required documents (Protected)
// Query parameters: ?search=term&page=1&page_size=10
visa_router.get('/:country_id', auth_guard, async (req: Request, res: Response): Promise<void> => {
  try {
    const { country_id } = req.params;

    if (!country_id) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'country_id is required',
        code: 400,
      });
      return;
    }

    // Parse query parameters
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const page_size = req.query.page_size ? parseInt(String(req.query.page_size), 10) : 10;

    // Validate pagination parameters
    if (page < 1) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'page must be greater than 0',
        code: 400,
      });
      return;
    }

    if (page_size < 1 || page_size > 100) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'page_size must be between 1 and 100',
        code: 400,
      });
      return;
    }

    const result = await visa_service.getVisaTypesByCountryId({
      country_id,
      ...(search ? { search } : {}),
      page,
      page_size,
    });

    res.status(200).json(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
        code: 404,
      });
      return;
    }

    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch visa types',
      code: 500,
    });
  }
});

export default visa_router;

