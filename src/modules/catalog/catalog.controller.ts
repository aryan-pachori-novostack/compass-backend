import { type Request, type Response } from 'express';
import {
  getCountries,
  getVisaTypesByCountry,
  getVisaVariantsByVisaType,
  getVisaVariantDetail,
  getRequiredDocuments,
} from './catalog.service.js';
import logger from '../../utils/logger.js';

/**
 * Cache control middleware helper
 */
function setCacheHeaders(res: Response, maxAge: number = 300) {
  res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
}

/**
 * Get Countries List
 * GET /catalog/countries
 */
export async function getCountriesController(req: Request, res: Response): Promise<void> {
  try {
    const includePaused = req.query.includePaused !== 'false'; // Default true

    const countries = await getCountries(includePaused);

    // Set cache headers (5 minutes)
    setCacheHeaders(res, 300);

    res.status(200).json(countries);
  } catch (error) {
    logger.error('Get countries error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get countries',
      code: 500,
    });
  }
}

/**
 * Get Visa Types by Country
 * GET /catalog/countries/:countryId/visa-types
 */
export async function getVisaTypesController(req: Request, res: Response): Promise<void> {
  try {
    const countryId = req.params.countryId;
    if (!countryId) {
      res.status(400).json({
        error: 'COUNTRY_ID_REQUIRED',
        message: 'Country ID is required',
        code: 400,
      });
      return;
    }

    const result = await getVisaTypesByCountry(countryId);

    // Set cache headers (10 minutes)
    setCacheHeaders(res, 600);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'COUNTRY_NOT_FOUND') {
        res.status(404).json({
          error: 'COUNTRY_NOT_FOUND',
          message: 'Country not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'COUNTRY_INACTIVE') {
        res.status(404).json({
          error: 'COUNTRY_INACTIVE',
          message: 'Country is not active',
          code: 404,
        });
        return;
      }
    }

    logger.error('Get visa types error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get visa types',
      code: 500,
    });
  }
}

/**
 * Get Visa Variants by Visa Type
 * GET /catalog/visa-types/:visaTypeId/variants
 */
export async function getVisaVariantsController(req: Request, res: Response): Promise<void> {
  try {
    const visaTypeId = req.params.visaTypeId;
    if (!visaTypeId) {
      res.status(400).json({
        error: 'VISA_TYPE_ID_REQUIRED',
        message: 'Visa type ID is required',
        code: 400,
      });
      return;
    }

    const variants = await getVisaVariantsByVisaType(visaTypeId);

    // Set cache headers (10 minutes)
    setCacheHeaders(res, 600);

    res.status(200).json(variants);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'VISA_TYPE_NOT_FOUND') {
        res.status(404).json({
          error: 'VISA_TYPE_NOT_FOUND',
          message: 'Visa type not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'VISA_TYPE_INACTIVE') {
        res.status(404).json({
          error: 'VISA_TYPE_INACTIVE',
          message: 'Visa type is not active',
          code: 404,
        });
        return;
      }
    }

    logger.error('Get visa variants error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get visa variants',
      code: 500,
    });
  }
}

/**
 * Get Complete Visa Variant Detail
 * GET /catalog/visa-variants/:variantId
 */
export async function getVisaVariantDetailController(req: Request, res: Response): Promise<void> {
  try {
    const variantId = req.params.variantId;
    if (!variantId) {
      res.status(400).json({
        error: 'VARIANT_ID_REQUIRED',
        message: 'Variant ID is required',
        code: 400,
      });
      return;
    }

    const result = await getVisaVariantDetail(variantId);

    // Set cache headers (15 minutes - most detailed view)
    setCacheHeaders(res, 900);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'VARIANT_NOT_FOUND') {
        res.status(404).json({
          error: 'VARIANT_NOT_FOUND',
          message: 'Visa variant not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'VARIANT_INACTIVE') {
        res.status(404).json({
          error: 'VARIANT_INACTIVE',
          message: 'Visa variant is not active',
          code: 404,
        });
        return;
      }
    }

    logger.error('Get visa variant detail error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get visa variant detail',
      code: 500,
    });
  }
}

/**
 * Get Required Documents for Visa Type
 * GET /catalog/visa-types/:visaTypeId/documents
 */
export async function getRequiredDocumentsController(req: Request, res: Response): Promise<void> {
  try {
    const visaTypeId = req.params.visaTypeId;
    if (!visaTypeId) {
      res.status(400).json({
        error: 'VISA_TYPE_ID_REQUIRED',
        message: 'Visa type ID is required',
        code: 400,
      });
      return;
    }

    const documents = await getRequiredDocuments(visaTypeId);

    // Set cache headers (10 minutes)
    setCacheHeaders(res, 600);

    res.status(200).json(documents);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'VISA_TYPE_NOT_FOUND') {
        res.status(404).json({
          error: 'VISA_TYPE_NOT_FOUND',
          message: 'Visa type not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'VISA_TYPE_INACTIVE') {
        res.status(404).json({
          error: 'VISA_TYPE_INACTIVE',
          message: 'Visa type is not active',
          code: 404,
        });
        return;
      }
    }

    logger.error('Get required documents error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get required documents',
      code: 500,
    });
  }
}
