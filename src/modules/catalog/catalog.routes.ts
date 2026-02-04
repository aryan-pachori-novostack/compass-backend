import { Router } from 'express';
import {
  getCountriesController,
  getVisaTypesController,
  getVisaVariantsController,
  getVisaVariantDetailController,
  getRequiredDocumentsController,
} from './catalog.controller.js';

const router = Router();

/**
 * GET /catalog/countries
 * Get all active countries
 */
router.get('/countries', getCountriesController);

/**
 * GET /catalog/countries/:countryId/visa-types
 * Get visa types for a country
 */
router.get('/countries/:countryId/visa-types', getVisaTypesController);

/**
 * GET /catalog/visa-types/:visaTypeId/variants
 * Get visa variants for a visa type
 */
router.get('/visa-types/:visaTypeId/variants', getVisaVariantsController);

/**
 * GET /catalog/visa-variants/:variantId
 * Get complete visa variant detail
 */
router.get('/visa-variants/:variantId', getVisaVariantDetailController);

/**
 * GET /catalog/visa-types/:visaTypeId/documents
 * Get required documents for a visa type
 */
router.get('/visa-types/:visaTypeId/documents', getRequiredDocumentsController);

export default router;
