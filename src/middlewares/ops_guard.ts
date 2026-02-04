import { type Request, type Response, type NextFunction } from 'express';
import { authGuard, type AuthRequest } from './auth_guard.js';

/**
 * Ops Guard Middleware
 * Requires JWT authentication and OPS role
 */
export function opsGuard(req: Request, res: Response, next: NextFunction): void {
  // First check JWT auth
  authGuard(req, res, () => {
    const authReq = req as AuthRequest;
    
    // Check if user has OPS role
    // For now, we'll use a simple check - in production, this would come from JWT payload
    // Since schema doesn't have OpsUser, we'll use a config-based approach
    const opsToken = process.env.OPS_API_KEY || 'ops-secret-key';
    const providedToken = req.headers['x-ops-token'] as string;
    
    // Alternative: Check JWT role if available
    const userRole = (authReq as any).role || (authReq as any).user?.role;
    
    if (userRole === 'OPS' || providedToken === opsToken) {
      // Attach ops user info
      (authReq as any).opsUserId = authReq.partnerId || 'ops-user';
      (authReq as any).isOps = true;
      next();
    } else {
      res.status(403).json({
        error: 'OPS_ACCESS_DENIED',
        message: 'Ops role required',
        code: 403,
      });
    }
  });
}

export type OpsRequest = AuthRequest & {
  opsUserId: string;
  isOps: boolean;
};
