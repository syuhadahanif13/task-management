import app from '../server';

export default function handler(req: any, res: any) {
  // If Vercel rewrote the URL and stripped /api, restore /api prefix for Express routes
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
