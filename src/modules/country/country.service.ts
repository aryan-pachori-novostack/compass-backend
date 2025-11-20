import prisma from '../../config/prisma.js';

export interface CountryResponse {
  id: string;
  country_id: string;
  iso_code: string;
  name: string;
  default_currency: string | null;
}

export interface PaginatedCountryResponse {
  data: CountryResponse[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

interface GetCountriesParams {
  search?: string;
  page?: number;
  page_size?: number;
}

class CountryService {
  async getActiveCountries(params?: GetCountriesParams): Promise<PaginatedCountryResponse> {
    try {
      const page = params?.page || 1;
      const page_size = params?.page_size || 10;
      const search = params?.search?.trim().toLowerCase() || '';

      // Build where clause
      const where_clause: any = {
        is_active: true,
      };

      // Add search filter if provided
      if (search) {
        where_clause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { iso_code: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get total count for pagination
      const total = await prisma.country.count({
        where: where_clause,
      });

      // Calculate pagination
      const total_pages = Math.ceil(total / page_size);
      const skip = (page - 1) * page_size;

      // Fetch countries with pagination
      const countries = await prisma.country.findMany({
        where: where_clause,
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          country_id: true,
          iso_code: true,
          name: true,
          default_currency: true,
        },
        skip,
        take: page_size,
      });

      return {
        data: countries,
        pagination: {
          total,
          page,
          page_size,
          total_pages,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch countries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new CountryService();
