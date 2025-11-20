import { Router, type Request, type Response } from 'express';
import auth_service from '../../modules/auth/auth.service.js';

const auth_router = Router();

// POST /auth/login - Partner login
auth_router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'email is required',
        code: 400,
      });
      return;
    }

    if (!password) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'password is required',
        code: 400,
      });
      return;
    }

    const result = await auth_service.login({
      email,
      password,
    });

    res.status(200).json({
      data: {
        token: result.token,
        partner: result.partner,
      },
    });
  } catch (error: unknown) {
    // Check authentication errors first (more specific)
    if (error instanceof Error && error.message.includes('Invalid email or password')) {
      res.status(401).json({
        error: 'AUTHENTICATION_ERROR',
        message: error.message,
        code: 401,
      });
      return;
    }

    if (error instanceof Error && error.message.includes('inactive')) {
      res.status(403).json({
        error: 'ACCOUNT_INACTIVE',
        message: error.message,
        code: 403,
      });
      return;
    }

    // Then check validation errors (less specific)
    if (error instanceof Error && error.message.includes('Invalid email format')) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
        code: 400,
      });
      return;
    }

    if (error instanceof Error && (error.message.includes('required') || error.message.includes('characters long'))) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
        code: 400,
      });
      return;
    }

    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to login',
      code: 500,
    });
  }
});

export default auth_router;

