# GoldPOS VPS deployment

The production stack runs the GoldPOS Node application on port `3003` and MySQL on an internal Docker network. The public hostname is `goldpos.shwetaungnyunt.tech`, served through the Hostinger VPS Nginx reverse proxy with HTTPS.

The application uses the Manus OAuth variables when supplied. Database migrations run once before the app container starts.
