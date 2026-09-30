# GCP integration notes

The frontend does not require GCP to run.

Use GCP only when the project needs production infrastructure such as:
- Cloud Run / Cloud Functions for APIs
- Firebase Authentication
- Firestore for products, customers, carts and orders
- Cloud Storage for product images
- Cloud Logging / Monitoring

Recommended production split:
Browser (HTML/CSS/JS) -> API (Cloud Run or Apps Script) -> Firestore/Cloud SQL
                                  |
                                  -> Payment provider

Never put private API keys, service-account JSON, database passwords, or payment secrets inside HTML/CSS/JS.
