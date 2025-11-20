import prisma from '../../config/prisma.js';

export interface VisaFeeResponse {
  id: string;
  visa_fee_id: string;
  base_fee_amount: number;
  service_fee_amount: number | null;
  currency: string;
  tax_amount: number | null;
  nationality_country_id: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
}

export interface RequiredDocumentResponse {
  id: string;
  visa_required_document_id: string;
  document_code: string;
  document_name: string;
  description: string | null;
  is_mandatory: boolean;
  allowed_file_types: string | null;
  max_file_size_mb: number | null;
}

export interface VisaTypeResponse {
  id: string;
  visa_type_id: string;
  country_id: string;
  code: string | null;
  name: string;
  category: string | null;
  description: string | null;
  processing_days: number | null;
  is_active: boolean;
  visa_fees: VisaFeeResponse[];
  required_documents: RequiredDocumentResponse[];
  created_at: Date;
  updated_at: Date;
}

export interface PaginatedVisaTypeResponse {
  data: VisaTypeResponse[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

interface GetVisaTypesParams {
  country_id: string;
  search?: string;
  page?: number;
  page_size?: number;
}

class VisaService {
  async getVisaTypesByCountryId(params: GetVisaTypesParams): Promise<PaginatedVisaTypeResponse> {
    const { country_id, search, page = 1, page_size = 10 } = params;
    try {
      // First verify country exists
      const country = await prisma.country.findUnique({
        where: {
          id: country_id,
        },
      });

      if (!country) {
        throw new Error(`Country with id '${country_id}' not found`);
      }

      // Build where clause
      const search_term = search?.trim().toLowerCase() || '';
      const where_clause: any = {
        country_id: country_id,
        is_active: true,
      };

      // Add search filter if provided
      if (search_term) {
        where_clause.OR = [
          { name: { contains: search_term, mode: 'insensitive' } },
          { category: { contains: search_term, mode: 'insensitive' } },
          { code: { contains: search_term, mode: 'insensitive' } },
        ];
      }

      // Get total count for pagination
      const total = await prisma.visaType.count({
        where: where_clause,
      });

      // Calculate pagination
      const total_pages = Math.ceil(total / page_size);
      const skip = (page - 1) * page_size;

      // Fetch visa types with fees and required documents
      const visa_types = await prisma.visaType.findMany({
        where: where_clause,
        include: {
          visa_fees: {
            where: {
              // Only include valid fees (not expired)
              OR: [
                { valid_to: null },
                { valid_to: { gte: new Date() } },
              ],
            },
            orderBy: {
              base_fee_amount: 'asc',
            },
          },
          required_documents: {
            orderBy: {
              is_mandatory: 'desc', // Mandatory documents first
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        skip,
        take: page_size,
      });

      const mapped_visa_types = visa_types.map((visa_type) => ({
        id: visa_type.id,
        visa_type_id: visa_type.visa_type_id,
        country_id: visa_type.country_id,
        code: visa_type.code,
        name: visa_type.name,
        category: visa_type.category,
        description: visa_type.description,
        processing_days: visa_type.processing_days,
        is_active: visa_type.is_active,
        visa_fees: visa_type.visa_fees.map((fee) => ({
          id: fee.id,
          visa_fee_id: fee.visa_fee_id,
          base_fee_amount: fee.base_fee_amount,
          service_fee_amount: fee.service_fee_amount,
          currency: fee.currency,
          tax_amount: fee.tax_amount,
          nationality_country_id: fee.nationality_country_id,
          valid_from: fee.valid_from,
          valid_to: fee.valid_to,
        })),
        required_documents: visa_type.required_documents.map((doc) => ({
          id: doc.id,
          visa_required_document_id: doc.visa_required_document_id,
          document_code: doc.document_code,
          document_name: doc.document_name,
          description: doc.description,
          is_mandatory: doc.is_mandatory,
          allowed_file_types: doc.allowed_file_types,
          max_file_size_mb: doc.max_file_size_mb,
        })),
        created_at: visa_type.created_at,
        updated_at: visa_type.updated_at,
      }));

      return {
        data: mapped_visa_types,
        pagination: {
          total,
          page,
          page_size,
          total_pages,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to fetch visa types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new VisaService();

