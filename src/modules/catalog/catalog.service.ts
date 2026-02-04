import prisma from '../../config/prisma.js';

/**
 * Get all active countries
 */
export async function getCountries(includePaused: boolean = true) {
  const whereClause: { is_active: boolean; is_paused?: boolean } = {
    is_active: true,
  };

  if (!includePaused) {
    whereClause.is_paused = false;
  }

  const countries = await prisma.country.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      iso_code: true,
      is_paused: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return countries;
}

/**
 * Get visa types by country
 */
export async function getVisaTypesByCountry(countryId: string) {
  // First verify country exists and get its info
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: {
      id: true,
      name: true,
      iso_code: true,
      is_paused: true,
      is_active: true,
    },
  });

  if (!country) {
    throw new Error('COUNTRY_NOT_FOUND');
  }

  if (!country.is_active) {
    throw new Error('COUNTRY_INACTIVE');
  }

  // Get active visa types for this country
  const visaTypes = await prisma.visaType.findMany({
    where: {
      country_id: countryId,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      category: true,
      processing_days_min: true,
      processing_days_max: true,
      validity_days: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return {
    country: {
      id: country.id,
      name: country.name,
      iso_code: country.iso_code,
      is_paused: country.is_paused,
    },
    visa_types: visaTypes,
  };
}

/**
 * Get visa variants by visa type
 */
export async function getVisaVariantsByVisaType(visaTypeId: string) {
  // First verify visa type exists and is active
  const visaType = await prisma.visaType.findUnique({
    where: { id: visaTypeId },
    select: {
      id: true,
      is_active: true,
    },
  });

  if (!visaType) {
    throw new Error('VISA_TYPE_NOT_FOUND');
  }

  if (!visaType.is_active) {
    throw new Error('VISA_TYPE_INACTIVE');
  }

  // Get active variants
  const variants = await prisma.visaVariant.findMany({
    where: {
      visa_type_id: visaTypeId,
      is_active: true,
    },
    select: {
      id: true,
      variant_name: true,
      entry_type: true,
      duration_days: true,
      processing_text: true,
      currency: true,
      adult_fee: true,
      child_fee: true,
      taxes_fee: true,
    },
    orderBy: [
      { duration_days: 'asc' },
      { entry_type: 'asc' },
      { variant_name: 'asc' },
    ],
  });

  // Format response with fees
  return variants.map((variant) => ({
    id: variant.id,
    variant_name: variant.variant_name,
    entry_type: variant.entry_type,
    duration_days: variant.duration_days,
    processing_text: variant.processing_text,
    fees: {
      adult: variant.adult_fee,
      child: variant.child_fee,
      taxes: variant.taxes_fee,
      currency: variant.currency,
    },
  }));
}

/**
 * Get complete visa variant detail
 */
export async function getVisaVariantDetail(variantId: string) {
  // Get variant with relations
  const variant = await prisma.visaVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      variant_name: true,
      entry_type: true,
      duration_days: true,
      processing_text: true,
      currency: true,
      adult_fee: true,
      child_fee: true,
      taxes_fee: true,
      is_active: true,
      visa_type: {
        select: {
          id: true,
          name: true,
          category: true,
          processing_days_min: true,
          processing_days_max: true,
          country: {
            select: {
              id: true,
              name: true,
              iso_code: true,
              is_paused: true,
            },
          },
        },
      },
    },
  });

  if (!variant) {
    throw new Error('VARIANT_NOT_FOUND');
  }

  if (!variant.is_active) {
    throw new Error('VARIANT_INACTIVE');
  }

  // Get required documents for this visa type
  const requiredDocuments = await prisma.visaRequiredDocument.findMany({
    where: {
      visa_type_id: variant.visa_type.id,
    },
    select: {
      document_code: true,
      document_name: true,
      is_mandatory: true,
    },
    orderBy: [
      { is_mandatory: 'desc' },
      { document_name: 'asc' },
    ],
  });

  // Format processing days
  const processingDays =
    variant.visa_type.processing_days_min && variant.visa_type.processing_days_max
      ? `${variant.visa_type.processing_days_min}–${variant.visa_type.processing_days_max} days`
      : variant.visa_type.processing_days_min
      ? `${variant.visa_type.processing_days_min} days`
      : variant.processing_text || null;

  return {
    country: {
      id: variant.visa_type.country.id,
      name: variant.visa_type.country.name,
      iso_code: variant.visa_type.country.iso_code,
      is_paused: variant.visa_type.country.is_paused,
    },
    visa_type: {
      id: variant.visa_type.id,
      name: variant.visa_type.name,
      category: variant.visa_type.category,
      processing_days: processingDays,
    },
    variant: {
      id: variant.id,
      variant_name: variant.variant_name,
      entry_type: variant.entry_type,
      duration_days: variant.duration_days,
      fees: {
        adult: variant.adult_fee,
        child: variant.child_fee,
        taxes: variant.taxes_fee,
        currency: variant.currency,
      },
    },
    required_documents: requiredDocuments.map((doc) => ({
      document_code: doc.document_code,
      document_name: doc.document_name,
      is_mandatory: doc.is_mandatory,
    })),
  };
}

/**
 * Get required documents for visa type
 */
export async function getRequiredDocuments(visaTypeId: string) {
  // Verify visa type exists and is active
  const visaType = await prisma.visaType.findUnique({
    where: { id: visaTypeId },
    select: {
      id: true,
      is_active: true,
    },
  });

  if (!visaType) {
    throw new Error('VISA_TYPE_NOT_FOUND');
  }

  if (!visaType.is_active) {
    throw new Error('VISA_TYPE_INACTIVE');
  }

  // Get required documents
  const documents = await prisma.visaRequiredDocument.findMany({
    where: {
      visa_type_id: visaTypeId,
    },
    select: {
      document_code: true,
      document_name: true,
      is_mandatory: true,
      allowed_types: true,
      max_size_mb: true,
    },
    orderBy: [
      { is_mandatory: 'desc' },
      { document_name: 'asc' },
    ],
  });

  return documents.map((doc) => ({
    document_code: doc.document_code,
    document_name: doc.document_name,
    is_mandatory: doc.is_mandatory,
    allowed_types: doc.allowed_types,
    max_size_mb: doc.max_size_mb,
  }));
}
