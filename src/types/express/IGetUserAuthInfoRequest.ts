import { Request } from 'express';

export interface IGetUserAuthInfoRequest extends Request {
  user?: {
    id: number;
    role_id: number;
  };
} 