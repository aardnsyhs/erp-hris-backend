import 'dotenv/config';
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  debug: false,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});