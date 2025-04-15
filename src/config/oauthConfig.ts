import dotenv from 'dotenv';

dotenv.config();

export const OAUTH_CONFIG = {
  clientId: '67c9cb098da1137b89843994-m8dcpur8' as string,
  clientSecret: 'cdfdf18d-be9b-4012-b41e-78d8a313fb86' as string,
  redirectUri: `${process.env.REDIRECT_URI || 'https://api.axdashboard.com/auth/callback'}` as string,
  authUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation' as string,
  tokenUrl: 'https://services.leadconnectorhq.com/oauth/token' as string,
  scope: 'opportunities.readonly',
};
