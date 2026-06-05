# PropManagerr

**Self-hosted UK landlord property management software for managing properties, tenants, rent, documents, repairs, expenses and compliance in one place.**

PropManagerr is a web-based property management platform designed for UK landlords who want control of their own data. It runs on your own server, NAS or hosting environment and includes an admin dashboard plus a tenant portal.

---

## Why PropManagerr?

Many landlord tools are cloud-only, expensive, or not designed around small private landlords. PropManagerr is being built as a practical self-hosted alternative for landlords who want:

* Property and tenant management
* Rent tracking
* Repair reporting
* Document storage
* Compliance awareness
* Expense tracking
* Tenant access
* Full control over hosting and data

---

## Current Features

### Admin Dashboard

* Portfolio overview
* Property status summary
* Rent collection overview
* Overdue rent visibility
* Compliance document reminders
* Recent repair tickets
* UK legal/compliance update section

### Property Management

* Add, edit and delete properties
* Track address, city, postcode, rent, bedrooms, property type and status
* Assign tenants to properties

### Tenant Management

* Add, edit and delete tenants
* Assign tenants to properties
* Track lease start/end dates
* Track payment status
* Manage tenant login accounts

### Rent Management

* View rent payments
* Edit payment status
* Track paid, pending and overdue rent
* Tenant portal rent view

### Documents & Compliance

* Upload property documents
* Upload tenant documents
* Upload global documents for all tenants
* View and delete documents
* Tenant access to assigned/global documents
* Track expiry dates for compliance documents

### Repairs & Maintenance

* Tenant repair reporting
* Admin repair management
* Track repair status
* Set urgency
* Add contractor, cost and notes
* Tenant repair history

### Expenses

* Expense tracking
* Expense categories
* Property-linked expenses
* Dashboard integration

### Tenant Portal

Tenants can log in and view:

* My property
* My tenancy
* My rent
* My documents
* My repairs

### Windows Desktop App

PropManagerr also has an Electron-based Windows desktop app that connects to the existing PropManagerr server.

The desktop app does not replace the server. It loads the existing hosted PropManagerr web/API app and provides a Windows installer experience.

---

## Screenshots

Screenshots coming soon.

Recommended screenshots to add:

1. Admin dashboard
2. Properties page
3. Tenant portal
4. Documents page
5. Repairs page
6. Windows desktop app

---

## Tech Stack

* React
* TypeScript
* Tailwind CSS
* Node.js
* Express
* PostgreSQL
* Docker
* TrueNAS SCALE custom app deployment
* Electron for Windows desktop client

---

## Deployment

PropManagerr is designed to be self-hosted.

Current deployment target:

* Docker / Docker Compose
* TrueNAS SCALE custom app
* PostgreSQL database
* Persistent uploads volume

Example:

```bash
docker compose up -d
```

---

## Windows Desktop App

The Windows app is built with Electron and connects to your existing PropManagerr server URL.

Build locally:

```bash
npm install
npm run electron:build
```

The installer is generated in:

```text
release/
```

---

## Project Status

PropManagerr is actively under development.

Current stable areas include:

* Admin login
* Tenant login
* Dashboard
* Properties
* Tenants
* Rent payments
* Documents
* Tenant portal
* Repairs/maintenance
* Expenses
* Windows desktop wrapper

---

## Roadmap

Planned improvements:

* PDF preview
* Audit logging
* Advanced reporting
* Google Drive / external backup options
* More compliance automation
* Better mobile optimisation
* More installer/release polish
* Public demo screenshots

---

## Licence

This project is licensed under the MIT Licence.

© 2026 Christian Robertson

---

## Disclaimer

PropManagerr is intended as property management software and does not provide legal advice. Compliance/legal update features are for awareness only. Landlords should always check official UK government guidance or seek professional advice where required.
