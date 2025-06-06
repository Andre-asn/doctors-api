import { Request } from 'express';

export interface IGetUserAuthInfoRequest extends Request {
  user?: {
    id: string;
    role_id: number;
  };
} 