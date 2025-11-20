import { Router, type Request, type Response } from 'express';
import country_service from '../../modules/country/country.service.js';
import { auth_guard } from '../../middlewares/auth_guard.js';

const country_router = Router();

// GET /country/ - Get all active countries with search and pagination (Protected)
country_router.get('/', auth_guard, async (req: Request, res: Response): Promise<void> => {
  try {
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

    const result = await country_service.getActiveCountries({
      ...(search ? { search } : {}),
      page,
      page_size,
    });

    res.status(200).json(result);
  } catch (error: unknown) {
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch countries',
      code: 500,
    });
  }
});

export default country_router;

